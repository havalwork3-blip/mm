"""Daily manager digest — all shops' jard + dashboard stats via Telegram."""

from __future__ import annotations

import html
import logging
import os
import time
from datetime import date, datetime, time as dt_time
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.utils import timezone

logger = logging.getLogger(__name__)

TELEGRAM_MSG_LIMIT = 4090
MAX_PRODUCT_LINES_PER_CATEGORY = 8
MAX_TOTAL_PRODUCT_LINES = 22
TELEGRAM_SEND_DELAY_SEC = 0.45


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


def format_intro_message(report_date: date, shops: list) -> str:
    active_count = sum(1 for s in shops if s.is_active)
    lines = [
        f"<b>📊 ڕاپۆرتی ڕۆژانەی بەڕێوەبەر</b>",
        f"📅 <code>{report_date.isoformat()}</code>",
        "",
        f"ژمارەی فرۆشگا: <b>{len(shops)}</b> (چالاک: {active_count})",
        "",
        "<b>📋 لیستی فرۆشگاکان</b>",
    ]
    for idx, shop in enumerate(shops, start=1):
        status = "✅" if shop.is_active else "⏸"
        lines.append(f"  <b>{idx}.</b> {status} {_esc(shop.name)}")
    lines.extend(
        [
            "",
            "⬇️ <i>لە خوارەوە هەر فرۆشگایەک لە پەیامێکی جیادا — بەبێ تێکەڵبوون.</i>",
        ],
    )
    text = "\n".join(lines)
    if len(text) > TELEGRAM_MSG_LIMIT:
        text = text[: TELEGRAM_MSG_LIMIT - 20] + "\n<i>…</i>"
    return text


def format_shop_jard_message(
    *,
    shop_name: str,
    shop_index: int,
    shop_total: int,
    is_active: bool,
    report_date: date,
    stats: dict,
    jard: dict,
) -> str:
    status = "✅ چالاک" if is_active else "⏸ ناچالاک"
    lines = [
        "━━━━━━━━━━━━━━━━━━━━",
        f"<b>[{shop_index}/{shop_total}] 🏪 {_esc(shop_name)}</b>",
        f"<i>{status}</i>",
        "",
        f"<b>📊 ئامارەکانی ڕۆژ</b> — <code>{report_date.isoformat()}</code>",
        f"• فرۆشتن: <b>${_usd(stats['sales_usd'])}</b>",
        f"• خەرجی: ${_usd(stats['expenses_usd'])}",
        f"• قازانج: <b>${_usd(stats['profit_usd'])}</b>",
        f"• داشکاندن: ${_usd(stats['discounts_usd'])}",
        f"• گەڕاوە: ${_usd(stats['returned_usd'])}",
        f"• قەرزی کڕیار: ${_usd(stats['receivables_usd'])}",
        f"• بەهای کۆگا: <b>${_usd(stats['stock_usd'])}</b>",
        f"• قاسە: ${_usd(stats['cash_drawer_usd'])}",
        "",
        "<b>📋 جەرد — کورتە</b>",
        f"• بەرهەم: {jard['product_count']}",
        f"• ماوە: <b>{jard['total_remaining_qty']}</b> دانە | ${_usd(jard['total_remaining_value_usd'])}",
        f"• فرۆشراو ئەمڕۆ: <b>{jard['total_sold_qty']}</b> دانە | ${_usd(jard['total_sold_value_usd'])}",
        "",
    ]

    categories = sorted(
        jard["by_category"].items(),
        key=lambda item: item[0].casefold(),
    )
    shown_total = 0
    truncated = False
    for cat_name, products in categories:
        if truncated:
            break
        lines.append(f"<b>📂 {_esc(cat_name)}</b>")
        shown_in_cat = 0
        for p in products:
            if shown_total >= MAX_TOTAL_PRODUCT_LINES:
                truncated = True
                extra = jard["product_count"] - shown_total
                if extra > 0:
                    lines.append(f"  <i>… +{extra} بەرهەم زیاتر</i>")
                break
            if shown_in_cat >= MAX_PRODUCT_LINES_PER_CATEGORY:
                extra_cat = len(products) - MAX_PRODUCT_LINES_PER_CATEGORY
                if extra_cat > 0:
                    lines.append(f"  <i>… +{extra_cat} لەم پۆلە</i>")
                break
            rem = int(p["remaining_qty"])
            sold = int(p.get("sold_qty", 0))
            rv = _usd(p.get("remaining_value_usd", 0))
            sv = _usd(p.get("sold_value_usd", 0))
            lines.append(
                f"  • {_esc(p['product_name'])}\n"
                f"    ماوە: {rem} | فرۆش: {sold} | ${_sv} | کۆگا: ${_rv}",
            )
            shown_in_cat += 1
            shown_total += 1
        lines.append("")

    text = "\n".join(lines).strip()
    if len(text) > TELEGRAM_MSG_LIMIT:
        text = text[: TELEGRAM_MSG_LIMIT - 20] + "\n<i>…</i>"
    return text


def _telegram_pause() -> None:
    time.sleep(TELEGRAM_SEND_DELAY_SEC)


def send_manager_daily_digest(
    settings,
    *,
    report_date: date | None = None,
    force: bool = False,
) -> dict:
    """
    Send intro + one Telegram message per shop (separate, numbered).
    Returns {sent, shops, shop_ok, failed: [{id, name, error}]}.
    """
    from shops.models import Shop
    from shops.telegram_notify import send_message

    result = {
        "sent": 0,
        "shops": 0,
        "shop_ok": 0,
        "failed": [],
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
    sent = 0

    intro = format_intro_message(d, shops)
    if send_message(token, chat_id, intro):
        sent += 1
    _telegram_pause()

    for idx, shop in enumerate(shops, start=1):
        try:
            stats = shop_daily_stats(shop.pk, d)
            jard = jard_summary_for_shop(shop.pk, d_from=d, d_to=d)
            body = format_shop_jard_message(
                shop_name=shop.name,
                shop_index=idx,
                shop_total=shop_total,
                is_active=shop.is_active,
                report_date=d,
                stats=stats,
                jard=jard,
            )
            if send_message(token, chat_id, body):
                sent += 1
                result["shop_ok"] += 1
            else:
                result["failed"].append(
                    {"id": shop.pk, "name": shop.name, "error": "telegram_send_failed"},
                )
        except Exception as exc:
            logger.exception("Manager daily digest failed for shop %s", shop.pk)
            result["failed"].append(
                {"id": shop.pk, "name": shop.name, "error": str(exc)[:200]},
            )
        _telegram_pause()

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
        f"ڕۆژانە ڕاپۆرتی جەرد و ئامار بۆ <b>هەر فرۆشگایەک</b> "
        f"لە پەیامێکی جیا دەنێردرێت (لیستی سەرەوە + پەیامی جیا بۆ هەر دووکان)."
    )
    return send_message(token, chat_id, text)


def should_run_scheduled_send(settings) -> bool:
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
