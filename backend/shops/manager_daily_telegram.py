"""Daily manager digest — all shops in one Telegram message (clear sections per shop)."""

from __future__ import annotations

import html
import logging
import os
import time
from datetime import date
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.utils import timezone

logger = logging.getLogger(__name__)

TELEGRAM_MSG_LIMIT = 4090
TELEGRAM_SEND_DELAY_SEC = 0.35
# Per shop inside combined message (keep compact so 3+ shops fit one message)
MAX_PRODUCT_LINES_PER_SHOP = 5


def _business_tz():
    tz_name = os.environ.get("DJANGO_BUSINESS_TZ", "Asia/Baghdad")
    try:
        return ZoneInfo(tz_name)
    except Exception:
        return timezone.get_current_timezone()


def business_today() -> date:
    return timezone.now().astimezone(_business_tz()).date()


def _esc(text: str) -> str:
    return html.escape((text or "").strip(), quote=False)


def _usd(value: Decimal | str | int | float) -> str:
    try:
        d = Decimal(str(value))
    except Exception:
        d = Decimal("0")
    return format(d.quantize(Decimal("0.01")), "f")


def shop_daily_stats(shop_id: int, d: date) -> dict:
    from inventory.dashboard_tools import (
        cashier_snapshot,
        net_profit_in_range,
        total_customer_discounts_usd_in_range,
        total_expenses_usd_in_range,
        total_returned_products_usd_in_range,
        total_receivables_usd_in_range,
        total_sales_usd_in_range,
        total_stock_value_usd,
    )

    cash = cashier_snapshot(shop_id, d, d)
    drawer = (
        Decimal(cash["sales_cash_in_usd"])
        - Decimal(cash["expenses_usd"])
        - Decimal(cash["employee_debt_cash_effect_usd"])
    ).quantize(Decimal("0.01"))
    return {
        "sales_usd": total_sales_usd_in_range(shop_id, d, d),
        "expenses_usd": total_expenses_usd_in_range(shop_id, d, d),
        "profit_usd": net_profit_in_range(shop_id, d, d),
        "discounts_usd": total_customer_discounts_usd_in_range(shop_id, d, d),
        "returned_usd": total_returned_products_usd_in_range(shop_id, d, d),
        "receivables_usd": total_receivables_usd_in_range(shop_id, d, d),
        "stock_usd": total_stock_value_usd(shop_id),
        "cash_drawer_usd": drawer,
    }


def format_shop_section(
    *,
    shop_name: str,
    shop_index: int,
    shop_total: int,
    is_active: bool,
    report_date: date,
    stats: dict,
    jard: dict,
) -> str:
    """One shop block inside the combined daily list."""
    status = "✅ چالاک" if is_active else "⏸ ناچالاک"
    lines = [
        "────────────────────",
        f"<b>{shop_index}. 🏪 {_esc(shop_name)}</b>  <i>{status}</i>",
        f"📊 فرۆشتن <b>${_usd(stats['sales_usd'])}</b> | قازانج <b>${_usd(stats['profit_usd'])}</b> | خەرجی ${_usd(stats['expenses_usd'])}",
        f"📦 کۆگا ${_usd(stats['stock_usd'])} | قاسە ${_usd(stats['cash_drawer_usd'])} | قەرز ${_usd(stats['receivables_usd'])}",
        (
            f"📋 جەرد: {jard['product_count']} بەرهەم | ماوە {jard['total_remaining_qty']} دانە "
            f"(${_usd(jard['total_remaining_value_usd'])}) | ئەمڕۆ فرۆش {jard['total_sold_qty']} "
            f"(${_usd(jard['total_sold_value_usd'])})"
        ),
    ]

    # Top sold / remaining products (compact)
    rows = jard.get("rows") or []
    if rows:
        by_sold = sorted(rows, key=lambda r: int(r.get("sold_qty") or 0), reverse=True)
        top = [r for r in by_sold if int(r.get("sold_qty") or 0) > 0][:MAX_PRODUCT_LINES_PER_SHOP]
        if not top:
            by_rem = sorted(rows, key=lambda r: int(r.get("remaining_qty") or 0), reverse=True)
            top = by_rem[:MAX_PRODUCT_LINES_PER_SHOP]
        if top:
            lines.append("<i>بەرهەم:</i>")
            for p in top:
                sold = int(p.get("sold_qty") or 0)
                rem = int(p.get("remaining_qty") or 0)
                lines.append(f"  • {_esc(p['product_name'])} — فرۆش {sold} | ماوە {rem}")
            extra = jard["product_count"] - len(top)
            if extra > 0:
                lines.append(f"  <i>… +{extra} بەرهەم</i>")

    return "\n".join(lines)


def build_combined_digest_messages(
    report_date: date,
    shop_blocks: list[str],
) -> list[str]:
    """Merge all shops into as few Telegram messages as possible (split only if > limit)."""
    active_note = ""
    header = [
        f"<b>📊 ڕاپۆرتی ڕۆژانەی بەڕێوەبەر</b>",
        f"📅 <code>{report_date.isoformat()}</code>",
        f"🏪 <b>{len(shop_blocks)}</b> فرۆشگا لە یەک لیست — هەر یەکە جیاکراوەتەوە:",
        "",
    ]
    parts: list[str] = ["\n".join(header)]
    parts.extend(shop_blocks)

    messages: list[str] = []
    current = ""
    for part in parts:
        chunk = part if not current else f"\n\n{part}"
        if len(current) + len(chunk) <= TELEGRAM_MSG_LIMIT:
            current += chunk
            continue
        if current.strip():
            messages.append(current.strip())
        # Part alone may still be too long — hard truncate shop block
        if len(part) > TELEGRAM_MSG_LIMIT:
            part = part[: TELEGRAM_MSG_LIMIT - 24] + "\n<i>…</i>"
        current = part

    if current.strip():
        messages.append(current.strip())

    return messages or ["<b>📊 ڕاپۆرت</b>\n<i>هیچ داتایەک نییە.</i>"]


def send_manager_daily_digest(
    settings,
    *,
    report_date: date | None = None,
    force: bool = False,
) -> dict:
    """
    Send one combined Telegram message (or 2+ only if text exceeds limit).
    Returns {sent, shops, shop_ok, failed, messages}.
    """
    from shops.models import Shop
    from shops.telegram_notify import send_message

    result: dict = {
        "sent": 0,
        "shops": 0,
        "shop_ok": 0,
        "failed": [],
        "messages": 0,
    }

    if not settings.manager_telegram_notify_enabled and not force:
        return result

    token = (settings.manager_telegram_bot_token or "").strip()
    chat_id = (settings.manager_telegram_chat_id or "").strip()
    if not token or not chat_id:
        logger.info("Manager daily Telegram skipped: missing token or chat_id")
        return result

    d = report_date or business_today()
    if not force and settings.manager_telegram_last_sent_date == d:
        logger.info("Manager daily Telegram already sent for %s", d)
        return result

    from inventory.jard_data import jard_summary_for_shop

    shops = list(Shop.objects.order_by("name"))
    result["shops"] = len(shops)
    if not shops:
        return result

    shop_total = len(shops)
    blocks: list[str] = []

    for idx, shop in enumerate(shops, start=1):
        try:
            stats = shop_daily_stats(shop.pk, d)
            jard = jard_summary_for_shop(shop.pk, d_from=d, d_to=d)
            blocks.append(
                format_shop_section(
                    shop_name=shop.name,
                    shop_index=idx,
                    shop_total=shop_total,
                    is_active=shop.is_active,
                    report_date=d,
                    stats=stats,
                    jard=jard,
                ),
            )
            result["shop_ok"] += 1
        except Exception as exc:
            logger.exception("Manager daily digest failed for shop %s", shop.pk)
            result["failed"].append(
                {"id": shop.pk, "name": shop.name, "error": str(exc)[:200]},
            )

    if not blocks:
        return result

    payloads = build_combined_digest_messages(d, blocks)
    result["messages"] = len(payloads)
    sent = 0
    for text in payloads:
        if send_message(token, chat_id, text):
            sent += 1
        time.sleep(TELEGRAM_SEND_DELAY_SEC)

    result["sent"] = sent
    settings.manager_telegram_last_sent_date = d
    settings.save(update_fields=["manager_telegram_last_sent_date", "updated_at"])
    return result


def send_manager_test_message(settings) -> bool:
    from shops.telegram_notify import send_message

    token = (settings.manager_telegram_bot_token or "").strip()
    chat_id = (settings.manager_telegram_chat_id or "").strip()
    if not token or not chat_id:
        return False
    d = business_today()
    text = (
        f"✅ <b>پەیامی تاقیکردنەوە</b>\n"
        f"بەستەرەکە کار دەکات.\n"
        f"📅 ڕۆژ: <code>{d.isoformat()}</code>\n\n"
        f"ڕاپۆرتی ڕۆژانە بۆ <b>هەموو فرۆشگاکان</b> لە "
        f"<b>یەک پەیام</b> دەنێردرێت — هەر فرۆشگا بەشێکی جیا لەناو لیستەکە."
    )
    return send_message(token, chat_id, text)


def should_run_scheduled_send(settings) -> bool:
    from datetime import time as dt_time

    if not settings.manager_telegram_notify_enabled:
        return False
    if not (settings.manager_telegram_bot_token or "").strip():
        return False
    if not (settings.manager_telegram_chat_id or "").strip():
        return False
    tz = _business_tz()
    now = timezone.now().astimezone(tz)
    today = now.date()
    if settings.manager_telegram_last_sent_date == today:
        return False
    target = dt_time(
        hour=int(settings.manager_telegram_send_hour or 8) % 24,
        minute=int(settings.manager_telegram_send_minute or 0) % 60,
    )
    return now.time() >= target
