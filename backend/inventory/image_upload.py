"""Validate uploaded images by their real content, not by the file name or browser-sent type."""

from __future__ import annotations

import os

from rest_framework.exceptions import ValidationError

# Pillow format name -> extension the file is stored under.
ALLOWED_IMAGE_FORMATS = {
    "JPEG": "jpg",
    "PNG": "png",
    "GIF": "gif",
    "WEBP": "webp",
    "BMP": "bmp",
    "TIFF": "tiff",
    "AVIF": "avif",
    "MPO": "jpg",  # multi-picture JPEG some phone cameras produce
}

ALLOWED_IMAGE_LABEL = "JPG, PNG, GIF, WEBP, BMP, TIFF, AVIF"


def validate_image_upload(upload, field: str = "image"):
    """
    Raise ValidationError unless `upload` really is an image in an allowed format.

    The stored name gets the extension of the detected format, so a file named
    `page.html` that is really a PNG is saved as `page.png` and never served as HTML.
    """
    from PIL import Image, UnidentifiedImageError

    error = ValidationError({field: f"Upload a valid image ({ALLOWED_IMAGE_LABEL})."})
    try:
        upload.seek(0)
        with Image.open(upload) as img:
            fmt = (img.format or "").upper()
            img.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise error from None
    finally:
        try:
            upload.seek(0)
        except Exception:
            pass

    ext = ALLOWED_IMAGE_FORMATS.get(fmt)
    if ext is None:
        raise error
    base = os.path.splitext(os.path.basename(upload.name or ""))[0] or "image"
    upload.name = f"{base[:80]}.{ext}"
    return upload
