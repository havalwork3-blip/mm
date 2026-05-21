"""Telegram Bot notifications for online storefront orders."""

from __future__ import annotations

import json
import logging
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal
from typing import Any

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"


def telegram_webhook_base_url() -> str:
    raw = (
        os.environ.get("TELEGRAM_WEBHOOK_BASE_URL", "").strip()
        or os.environ.get("PUBLIC_API_BASE_URL", "").strip()
        or "https://dashboard.mmiraq.com"
    )
    return raw.rstrip("/")


def ensure_link_code(settings) -> str:
    from shops.models import StorefrontSettings

    code = (settings.telegram_link_code or "").strip().upper()
    if not code:
        code = secrets.token_hex(4).upper()[:10]
        StorefrontSettings.objects.filter(pk=settings.pk).update(telegram_link_code=code)
        settings.telegram_link_code = code
    return code


def normalize_recipients(raw: object) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in raw:
        if not isinstance(row, dict):
            continue
        chat_id = str(row.get("chat_id", "")).strip()
        if not chat_id or chat_id in seen:
            continue
        seen.add(chat_id)
        label = str(row.get("label", "")).strip() or chat_id
        out.append(
            {
                "chat_id": chat_id,
                "label": label[:120],
                "connected_at": str(row.get("connected_at", ""))[:64],
            },
        )
    return out


def mask_bot_token(token: str) -> str:
    t = (token or "").strip()
    if len(t) <= 8:
        return "••••••••" if t else ""
    return f"••••••••{t[-6:]}"


def _api_call(token: str, method: str, payload: dict | None = None) -> dict | None:
    url = TELEGRAM_API.format(token=token.strip(), method=method)
    data = json.dumps(payload or {}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            if not body.get("ok"):
                logger.warning("Telegram API %s failed: %s", method, body)
                return None
            return body.get("result")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        logger.warning("Telegram API %s error: %s", method, exc)
        return None


def register_webhook(token: str) -> bool:
    webhook_url = f"{telegram_webhook_base_url()}/api/public/telegram/webhook/"
    result = _api_call(token, "setWebhook", {"url": webhook_url, "drop_pending_updates": True})
    return result is not None


def send_message(token: str, chat_id: str | int, text: str) -> bool:
    result = _api_call(
        token,
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        },
    )
    return result is not None


def format_order_message(order) -> str:
    lines = [
        "🛒 <b>داواکاری نوێ — ئۆنڵاین شۆپ</b>",
        "",
        f"<b>ژمارە:</b> #{order.id}",
        f"<b>ناو:</b> {order.customer_name}",
        f"<b>مۆبایل:</b> {order.customer_phone}",
        f"<b>ناونیشان:</b> {order.customer_address}",
    ]
    if order.delivery_zone_name:
        lines.append(f"<b>گەیاندن:</b> {order.delivery_zone_name}")
    lines.append("")
    for item in order.items.all():
        name = item.product.name if item.product_id else "—"
        lines.append(f"• {name} × {item.quantity}")
    lines.append("")
    lines.append(f"<b>کۆ:</b> ${order.total_amount}")
    return "\n".join(lines)


def notify_new_storefront_order(order_id: int) -> None:
    from inventory.models import StorefrontOrder
    from shops.storefront_settings_utils import get_or_create_storefront_settings

    try:
        order = (
            StorefrontOrder.objects.select_related("shop")
            .prefetch_related("items__product")
            .get(pk=order_id)
        )
    except StorefrontOrder.DoesNotExist:
        return

    settings = get_or_create_storefront_settings(order.shop)
    if not settings.telegram_notify_enabled:
        return
    token = (settings.telegram_bot_token or "").strip()
    if not token:
        return

    recipients = normalize_recipients(settings.telegram_recipients)
    if not recipients:
        return

    text = format_order_message(order)
    for row in recipients:
        try:
            send_message(token, row["chat_id"], text)
        except Exception:
            logger.exception("Telegram notify failed for chat %s", row.get("chat_id"))


def add_recipient(settings, chat_id: str | int, label: str) -> list[dict[str, Any]]:
    from django.utils import timezone

    recipients = normalize_recipients(settings.telegram_recipients)
    cid = str(chat_id).strip()
    now = timezone.now().isoformat()
    found = False
    for row in recipients:
        if row["chat_id"] == cid:
            row["label"] = (label or row["label"])[:120]
            row["connected_at"] = now
            found = True
    if not found:
        recipients.append(
            {
                "chat_id": cid,
                "label": (label or cid)[:120],
                "connected_at": now,
            },
        )
    settings.telegram_recipients = recipients
    settings.save(update_fields=["telegram_recipients", "updated_at"])
    return recipients


def process_telegram_update(payload: dict) -> None:
    from shops.models import StorefrontSettings

    message = payload.get("message") or payload.get("edited_message") or {}
    if not message:
        return

    text = (message.get("text") or "").strip()
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if chat_id is None:
        return

    first = (chat.get("first_name") or "").strip()
    last = (chat.get("last_name") or "").strip()
    username = (chat.get("username") or "").strip()
    label = " ".join(x for x in [first, last] if x).strip() or (f"@{username}" if username else str(chat_id))

    token_rows = list(
        StorefrontSettings.objects.exclude(telegram_bot_token="").filter(
            telegram_notify_enabled=True,
        )
    )
    if not token_rows:
        return

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        code = (parts[1] if len(parts) > 1 else "").strip().upper()
        if not code:
            for settings in token_rows:
                tok = (settings.telegram_bot_token or "").strip()
                if tok:
                    send_message(
                        tok,
                        chat_id,
                        "سڵاو! کۆدی پەیوەندی لە داشبۆرد → ئۆنڵاین شۆپ بنێرە:\n/start کۆدەکەت",
                    )
            return

        settings = (
            StorefrontSettings.objects.filter(telegram_link_code=code)
            .exclude(telegram_bot_token="")
            .first()
        )
        if settings is None:
            if token_rows:
                send_message(
                    token_rows[0].telegram_bot_token,
                    chat_id,
                    "کۆدەکە هەڵەیە. لە داشبۆرد کۆدی نوێ بگرە و دووبارە هەوڵبدەرەوە.",
                )
            return

        add_recipient(settings, chat_id, label)
        tok = (settings.telegram_bot_token or "").strip()
        if tok:
            send_message(
                tok,
                chat_id,
                "✅ پەیوەندیت کرا! ئێستا ئاگادارکردنەوەی داواکاری نوێ بۆ ئەم هەژمارە دەنێردرێت.",
            )
        return


def send_test_notification(settings) -> tuple[int, int]:
    token = (settings.telegram_bot_token or "").strip()
    recipients = normalize_recipients(settings.telegram_recipients)
    if not token or not recipients:
        return 0, 0
    ok = 0
    for row in recipients:
        if send_message(
            token,
            row["chat_id"],
            "✅ ئەمە پەیامێکی تاقیکردنەوەیە — کۆنێکت سەرکەوتووە!",
        ):
            ok += 1
    return ok, len(recipients)


def configure_telegram_on_save(settings) -> None:
    if not settings.telegram_notify_enabled:
        return
    token = (settings.telegram_bot_token or "").strip()
    if not token:
        return
    ensure_link_code(settings)
    register_webhook(token)
