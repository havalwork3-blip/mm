"""Public read/write marketing endpoints callable from mmiraq.com (cross-origin)."""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

# Public marketing JSON responses — cache only; CORS handled by django-cors-headers.
PUBLIC_API_HEADERS = {
    "Cache-Control": "no-store, max-age=0",
}


class PublicMarketingApiView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, *args, **kwargs)
        for key, value in PUBLIC_API_HEADERS.items():
            response[key] = value
        return response

    def options(self, request, *args, **kwargs):
        response = Response(status=200)
        for key, value in PUBLIC_API_HEADERS.items():
            response[key] = value
        return response
