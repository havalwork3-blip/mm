"""DRF exception handler — always JSON for API clients (no HTML debug pages)."""

from __future__ import annotations

import logging

from django.db.models.deletion import ProtectedError, RestrictedError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response

    # Deleting something still in use (a product that was sold, a category with
    # products, ...) is a normal user mistake, not a server crash.
    if isinstance(exc, (ProtectedError, RestrictedError)):
        return Response(
            {"detail": "This item is in use by other records (sales, purchases or products) and cannot be deleted."},
            status=409,
        )

    logger.exception("Unhandled API exception", exc_info=exc)
    return Response({"detail": "Internal server error."}, status=500)
