from app.core.config import settings
from app.services.parser.base import RecipeParser

def get_parser() -> RecipeParser:
    if settings.parser_backend == "ai":
        from app.services.parser.ai import AIRecipeParser
        return AIRecipeParser()
    from app.services.parser.local import LocalRecipeParser
    return LocalRecipeParser()
