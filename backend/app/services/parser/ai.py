from app.services.parser.base import RecipeParser, ParsedRecipe

class AIRecipeParser(RecipeParser):
    async def parse_url(self, url: str) -> ParsedRecipe:
        raise NotImplementedError(
            "AI parser not configured. Set PARSER_BACKEND=local or configure OPENAI_API_KEY."
        )

    async def parse_text(self, text: str) -> ParsedRecipe:
        raise NotImplementedError("AI parser not configured.")
