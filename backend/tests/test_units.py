import pytest
from app.utils.units import (
    parse_fraction,
    normalize_unit,
    format_quantity,
    try_combine,
)


# ── parse_fraction ────────────────────────────────────────────────────────────

def test_parse_fraction_integer():
    assert parse_fraction("3") == pytest.approx(3.0)

def test_parse_fraction_simple():
    assert parse_fraction("1/2") == pytest.approx(0.5)

def test_parse_fraction_mixed():
    assert parse_fraction("2 1/4") == pytest.approx(2.25)

def test_parse_fraction_decimal():
    assert parse_fraction(".5") == pytest.approx(0.5)

def test_parse_fraction_non_numeric():
    assert parse_fraction("to taste") is None

def test_parse_fraction_none():
    assert parse_fraction(None) is None


# ── normalize_unit ────────────────────────────────────────────────────────────

def test_normalize_unit_alias():
    assert normalize_unit("tbsp") == "tablespoon"

def test_normalize_unit_plural():
    assert normalize_unit("cups") == "cup"

def test_normalize_unit_tsp():
    assert normalize_unit("tsp") == "teaspoon"

def test_normalize_unit_none():
    assert normalize_unit(None) is None

def test_normalize_unit_oz():
    assert normalize_unit("oz") == "ounce"

def test_normalize_unit_lbs():
    assert normalize_unit("lbs") == "pound"


# ── format_quantity ───────────────────────────────────────────────────────────

def test_format_quantity_half():
    assert format_quantity(0.5) == "1/2"

def test_format_quantity_quarter():
    assert format_quantity(0.25) == "1/4"

def test_format_quantity_third():
    assert format_quantity(1/3) == "1/3"

def test_format_quantity_mixed():
    assert format_quantity(1.5) == "1 1/2"

def test_format_quantity_mixed_quarter():
    assert format_quantity(2.25) == "2 1/4"

def test_format_quantity_whole():
    assert format_quantity(3.0) == "3"

def test_format_quantity_none():
    assert format_quantity(None) == ""


# ── try_combine ───────────────────────────────────────────────────────────────

def test_combine_same_unit():
    qty, unit = try_combine(2.0, "cup", 1.0, "cup")
    assert qty == pytest.approx(3.0)
    assert unit == "cup"

def test_combine_volume_cross_unit():
    # 1 cup + 4 tablespoons = 1.25 cups
    qty, unit = try_combine(1.0, "cup", 4.0, "tablespoon")
    assert qty == pytest.approx(1.25, rel=1e-2)
    assert unit == "cup"

def test_combine_weight_cross_unit():
    # 1 pound + 8 ounces = 1.5 pounds
    qty, unit = try_combine(1.0, "pound", 8.0, "ounce")
    assert qty == pytest.approx(1.5, rel=1e-2)
    assert unit == "pound"

def test_combine_incompatible_categories():
    # volume + weight → not combinable
    assert try_combine(1.0, "cup", 200.0, "gram") is None

def test_combine_missing_qty():
    assert try_combine(None, "cup", 1.0, "cup") is None

def test_combine_non_convertible_same_unit():
    # "clove" + "clove" → sum
    qty, unit = try_combine(2.0, "clove", 3.0, "clove")
    assert qty == pytest.approx(5.0)
    assert unit == "clove"

def test_combine_non_convertible_different_units():
    # "can" vs "clove" → not combinable
    assert try_combine(1.0, "can", 2.0, "clove") is None
