"""DRF exception handler — always JSON for API clients (no HTML debug pages)."""

from __future__ import annotations

import logging

from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response

    logger.exception("Unhandled API exception", exc_info=exc)
    return Response({"detail": "Internal server error."}, status=500)
