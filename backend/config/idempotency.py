"""
Idempotency for write requests.

The dashboard sends a unique ``Idempotency-Key`` header with every POST/PUT/PATCH/DELETE and
keeps the same key when a request is queued offline and replayed. The first request with a
given key is processed normally and its response stored; any later request with the same key
(from the same login) gets that stored response back instead of being applied a second time.

Requests without the header behave exactly as before.
"""

from __future__ import annotations

import hashlib
import random
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.http import HttpResponse, JsonResponse
from django.utils import timezone

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_MAX_STORED_BODY = 1_000_000
# A request still marked "in progress" after this long crashed without cleanup: allow a retry.
_STALE_IN_PROGRESS = timedelta(minutes=10)
# Keys are remembered long enough to cover a device that stayed offline for weeks.
_RETENTION = timedelta(days=60)


def _owner_hash(request) -> str:
    auth = request.META.get("HTTP_AUTHORIZATION", "") or ""
    raw = auth or "anon:" + (request.META.get("REMOTE_ADDR") or "")
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class IdempotencyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        key = (request.META.get("HTTP_IDEMPOTENCY_KEY") or "").strip()
        if (
            request.method not in _WRITE_METHODS
            or not key
            or len(key) > 100
            or not request.path.startswith("/api/")
        ):
            return self.get_response(request)

        from inventory.models import IdempotencyRecord

        owner = _owner_hash(request)
        record = None
        try:
            with transaction.atomic():
                record = IdempotencyRecord.objects.create(
                    owner_hash=owner,
                    key=key,
                    method=request.method,
                    path=request.path[:500],
                )
        except IntegrityError:
            existing = IdempotencyRecord.objects.filter(owner_hash=owner, key=key).first()
            if existing is None:
                # Removed in the meantime (previous attempt failed): process normally.
                return self.get_response(request)
            if existing.status_code is not None:
                resp = HttpResponse(
                    existing.response_body,
                    status=existing.status_code,
                    content_type=existing.content_type or "application/json",
                )
                resp["Idempotency-Replayed"] = "true"
                return resp
            if timezone.now() - existing.created_at < _STALE_IN_PROGRESS:
                resp = JsonResponse(
                    {"detail": "This request is already being processed. Please wait."},
                    status=409,
                )
                resp["Idempotency-Status"] = "in-progress"
                return resp
            existing.delete()
            return self.__call__(request)

        try:
            response = self.get_response(request)
        except Exception:
            IdempotencyRecord.objects.filter(pk=record.pk).delete()
            raise

        if response.status_code >= 500 or getattr(response, "streaming", False):
            # Server error: nothing reliable to replay; let the client retry.
            IdempotencyRecord.objects.filter(pk=record.pk).delete()
        else:
            body = response.content if hasattr(response, "content") else b""
            if len(body) > _MAX_STORED_BODY:
                body = b""
            IdempotencyRecord.objects.filter(pk=record.pk).update(
                status_code=response.status_code,
                content_type=(response.get("Content-Type") or "")[:100],
                response_body=body.decode("utf-8", errors="replace"),
            )

        # Occasionally forget very old keys (only these technical rows, never business data).
        if random.random() < 0.01:
            IdempotencyRecord.objects.filter(created_at__lt=timezone.now() - _RETENTION).delete()
        return response
