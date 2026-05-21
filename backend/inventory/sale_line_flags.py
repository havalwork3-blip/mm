"""Classify sale lines sold at zero price or below cost (loss)."""

from __future__ import annotations

from decimal import Decimal


def sale_line_flags(
    unit_price_usd,
    unit_buy_price_usd,
    quantity: int = 1,
) -> dict[str, bool | str]:
    price = Decimal(str(unit_price_usd or 0))
    buy = Decimal(str(unit_buy_price_usd or 0))
    qty = max(0, int(quantity or 0))
    sold_at_zero = price == 0
    sold_at_loss = sold_at_zero and buy > 0 or (buy > 0 and price < buy)
    loss_per_unit = max(Decimal("0"), buy - price)
    line_loss_usd = (loss_per_unit * Decimal(qty)).quantize(Decimal("0.0001"))
    return {
        "sold_at_zero": sold_at_zero,
        "sold_at_loss": sold_at_loss,
        "line_loss_usd": format(line_loss_usd, "f"),
    }
