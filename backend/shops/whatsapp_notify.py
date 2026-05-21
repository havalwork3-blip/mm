"""WhatsApp Cloud API — customer notifications on online order status changes."""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from inventory.models import StorefrontOrder

logger = logging.getLogger(__name__)

WHATSAPP_GRAPH_VERSION = os.environ.get("WHATSAPP_API_VERSION", "v21.0").strip() or "v21.0"


def mask_access_token(token: str) -> str:
    t = (token or "").strip()
    if len(t) <= 8:
        return "••••••••" if t else ""
    return f"••••••••{t[-6:]}"


def normalize_whatsapp_phone(raw: str) -> str | None:
    """E.164 digits without + (default Iraq 964)."""
    digits = re.sub(r"\D", "", (raw or "").strip())
    if not digits:
        return None
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("9640"):
        digits = "964" + digits[4:]
    elif digits.startswith("0"):
        digits = "964" + digits[1:]
    elif len(digits) == 10 and digits[0] == "7":
        digits = "964" + digits
    elif len(digits) == 11 and digits.startswith("07"):
        digits = "964" + digits[1:]
    if len(digits) < 10 or len(digits) > 15:
        return None
    return digits


def get_whatsapp_credentials(settings) -> tuple[str, str] | None:
    token = (settings.whatsapp_access_token or "").strip() or os.environ.get(
        "WHATSAPP_ACCESS_TOKEN",
        "",
    ).strip()
    phone_id = (settings.whatsapp_phone_number_id or "").strip() or os.environ.get(
        "WHATSAPP_PHONE_NUMBER_ID",
        "",
    ).strip()
    if token and phone_id:
        return token, phone_id
    return None


def send_whatsapp_text(*, token: str, phone_number_id: str, to_e164: str, body: str) -> bool:
    url = (
        f"https://graph.facebook.com/{WHATSAPP_GRAPH_VERSION}/"
        f"{phone_number_id.strip()}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_e164,
        "type": "text",
        "text": {"preview_url": False, "body": body[:4096]},
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token.strip()}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            if 200 <= resp.status < 300:
                return True
            logger.warning("WhatsApp API status %s", resp.status)
            return False
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
        except Exception:
            detail = str(exc)
        logger.warning("WhatsApp send failed (%s): %s", exc.code, detail)
        return False
    except Exception:
        logger.exception("WhatsApp send failed")
        return False


def _shop_display_name(order: StorefrontOrder) -> str:
    shop = order.shop
    return (getattr(shop, "name", None) or "").strip() or "فرۆشگا"


def message_processing(order: StorefrontOrder) -> str:
    shop = _shop_display_name(order)
    name = (order.customer_name or "").strip() or "کڕیار"
    order_no = order.pk
    return (
        f"🛍️ *{shop}*\n\n"
        f"سڵاو {name}،\n\n"
        f"داواکاریەکەت (#{order_no}) *ئێستا لە ئامادەکردندایە* ✨\n"
        f"کاڵاکان بە وریایی کۆدەکرێنەوە و بەم زووانە ئامادە دەبن بۆ ناردن.\n\n"
        f"سوپاس بۆ متمانەتان 🙏"
    )


def message_completed(order: StorefrontOrder) -> str:
    shop = _shop_display_name(order)
    name = (order.customer_name or "").strip() or "کڕیار"
    order_no = order.pk
    addr = (order.customer_address or "").strip()
    addr_line = f"\n📍 ناونیشان: {addr[:200]}" if addr else ""
    return (
        f"🛍️ *{shop}*\n\n"
        f"سڵاو {name}،\n\n"
        f"داواکاری (#{order_no}) *تەواو کرا و لە ڕێگای گەیاندندایە* 📦🚚\n"
        f"بەم زووانە دەگاتە لات.{addr_line}\n\n"
        f"گەر پرسیارێکت هەبوو، پەیوەندیمان پێوە بکە."
    )


def notify_storefront_order_status(order_id: int, old_status: str, new_status: str) -> None:
    from inventory.models import StorefrontOrder, StorefrontOrderStatus
    from shops.storefront_settings_utils import get_or_create_storefront_settings

    if old_status == new_status:
        return
    if new_status not in (
        StorefrontOrderStatus.PROCESSING,
        StorefrontOrderStatus.COMPLETED,
    ):
        return

    try:
        order = (
            StorefrontOrder.objects.select_related("shop")
            .prefetch_related("items__product")
            .get(pk=order_id)
        )
    except StorefrontOrder.DoesNotExist:
        return

    settings = get_or_create_storefront_settings(order.shop)
    if not settings.whatsapp_customer_notify_enabled:
        return

    creds = get_whatsapp_credentials(settings)
    if not creds:
        logger.info("WhatsApp customer notify skipped: missing token or phone_number_id")
        return

    token, phone_id = creds
    to_phone = normalize_whatsapp_phone(order.customer_phone)
    if not to_phone:
        logger.info("WhatsApp customer notify skipped: invalid phone for order %s", order_id)
        return

    if new_status == StorefrontOrderStatus.PROCESSING:
        body = message_processing(order)
    else:
        body = message_completed(order)

    send_whatsapp_text(token=token, phone_number_id=phone_id, to_e164=to_phone, body=body)


def send_test_customer_notification(settings, phone: str | None = None) -> bool:
    """Send a sample processing message to verify API credentials."""
    creds = get_whatsapp_credentials(settings)
    if not creds:
        return False
    token, phone_id = creds
    raw = (phone or "").strip() or (settings.contact_whatsapp or "").strip()
    to_phone = normalize_whatsapp_phone(raw)
    if not to_phone:
        return False
    shop_name = ""
    if settings.shop_id:
        from shops.models import Shop

        shop = Shop.objects.filter(pk=settings.shop_id).first()
        if shop:
            shop_name = (shop.name or "").strip()
    shop = shop_name or "فرۆشگا"
    body = (
        f"🛍️ *{shop}*\n\n"
        f"سڵاو،\n\n"
        f"ئەمە *پەیامێکی تاقیکردنەوەیە* بۆ دڵنیابوونەوە لە پەیوەندی واتسئاپ.\n"
        f"کاتێک دۆخی داواکاری بگۆڕیت بۆ «لە جێبەجێکردندایە» یان «تەواو»، "
        f"کڕیارەکە پەیامێکی هاوشێوە وەردەگرێت. ✅"
    )
    return send_whatsapp_text(token=token, phone_number_id=phone_id, to_e164=to_phone, body=body)
