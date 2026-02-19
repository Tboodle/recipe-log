from __future__ import annotations
from fractions import Fraction

# ── Fraction parsing ──────────────────────────────────────────────────────────

def parse_fraction(s: str | None) -> float | None:
    """Parse "1/2", "2 1/4", "3", ".5" → float. Returns None for non-numeric."""
    if not s:
        return None
    s = s.strip()
    try:
        parts = s.split()
        if len(parts) == 2:
            return float(Fraction(parts[0])) + float(Fraction(parts[1]))
        return float(Fraction(s))
    except (ValueError, ZeroDivisionError):
        return None

# ── Unit normalization ────────────────────────────────────────────────────────

_ALIASES: dict[str, str] = {
    "tsp": "teaspoon", "t": "teaspoon",
    "tbsp": "tablespoon", "tbl": "tablespoon", "T": "tablespoon",
    "fl oz": "fluid_ounce", "floz": "fluid_ounce",
    "c": "cup",
    "pt": "pint",
    "qt": "quart",
    "gal": "gallon",
    "oz": "ounce",
    "lb": "pound", "lbs": "pound",
    "g": "gram",
    "kg": "kilogram",
    "ml": "milliliter", "mL": "milliliter",
    "l": "liter", "L": "liter",
}

def normalize_unit(unit: str | None) -> str | None:
    if not unit:
        return None
    stripped = unit.strip()
    if stripped in _ALIASES:
        return _ALIASES[stripped]
    lower = stripped.lower().rstrip("s")
    if lower in _ALIASES:
        return _ALIASES[lower]
    return lower

# ── Conversion tables ─────────────────────────────────────────────────────────

_VOLUME_TO_ML: dict[str, float] = {
    "teaspoon": 4.92892,
    "tablespoon": 14.7868,
    "fluid_ounce": 29.5735,
    "cup": 236.588,
    "pint": 473.176,
    "quart": 946.353,
    "gallon": 3785.41,
    "milliliter": 1.0,
    "liter": 1000.0,
}

_WEIGHT_TO_G: dict[str, float] = {
    "gram": 1.0,
    "ounce": 28.3495,
    "pound": 453.592,
    "kilogram": 1000.0,
}

_VOLUME_PREF = ["gallon", "quart", "pint", "cup", "fluid_ounce", "tablespoon", "teaspoon", "milliliter"]
_WEIGHT_PREF = ["kilogram", "pound", "ounce", "gram"]


def _best_volume(ml: float) -> tuple[float, str]:
    for unit in _VOLUME_PREF:
        qty = ml / _VOLUME_TO_ML[unit]
        if qty >= 0.7:
            return qty, unit
    return ml, "milliliter"


def _best_weight(g: float) -> tuple[float, str]:
    for unit in _WEIGHT_PREF:
        qty = g / _WEIGHT_TO_G[unit]
        if qty >= 0.7:
            return qty, unit
    return g, "gram"


def try_combine(
    existing_qty: float | None,
    existing_unit: str | None,
    new_qty: float | None,
    new_unit: str | None,
) -> tuple[float, str] | None:
    """Combine two quantities. Returns (combined, unit) or None if incompatible."""
    if existing_qty is None or new_qty is None:
        return None
    eu = normalize_unit(existing_unit)
    nu = normalize_unit(new_unit)
    if eu in _VOLUME_TO_ML and nu in _VOLUME_TO_ML:
        if eu == nu:
            return existing_qty + new_qty, eu
        total_ml = existing_qty * _VOLUME_TO_ML[eu] + new_qty * _VOLUME_TO_ML[nu]
        return _best_volume(total_ml)
    if eu in _WEIGHT_TO_G and nu in _WEIGHT_TO_G:
        if eu == nu:
            return existing_qty + new_qty, eu
        total_g = existing_qty * _WEIGHT_TO_G[eu] + new_qty * _WEIGHT_TO_G[nu]
        return _best_weight(total_g)
    if eu is not None and eu == nu:
        return existing_qty + new_qty, eu
    return None

# ── Quantity display ──────────────────────────────────────────────────────────

_FRACTIONS: list[tuple[float, str]] = [
    (1/8,  "1/8"),
    (1/4,  "1/4"),
    (1/3,  "1/3"),
    (3/8,  "3/8"),
    (1/2,  "1/2"),
    (5/8,  "5/8"),
    (2/3,  "2/3"),
    (3/4,  "3/4"),
    (7/8,  "7/8"),
]

def format_quantity(qty: float | None) -> str:
    if qty is None:
        return ""
    whole = int(qty)
    frac = qty - whole
    frac_str = next((s for val, s in _FRACTIONS if abs(frac - val) < 0.02), "")
    if whole == 0:
        return frac_str or f"{qty:.4g}"
    if not frac_str:
        return str(whole) if abs(frac) < 0.02 else f"{qty:.4g}"
    return f"{whole} {frac_str}"
