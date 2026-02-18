import pytest
from app.services.parser.local import LocalRecipeParser
from app.services.parser.factory import get_parser

async def test_parse_text_extracts_title():
    parser = LocalRecipeParser()
    result = await parser.parse_text("Simple Pasta\n2 cups flour\n1 egg")
    assert result.title == "Simple Pasta"
    assert "2 cups flour" in result.ingredients

async def test_parse_text_empty_returns_untitled():
    parser = LocalRecipeParser()
    result = await parser.parse_text("")
    assert result.title == "Untitled"

def test_factory_returns_local_parser():
    parser = get_parser()
    from app.services.parser.local import LocalRecipeParser
    assert isinstance(parser, LocalRecipeParser)
