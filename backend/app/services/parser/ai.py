from app.services.parser.base import RecipeParser, ParsedRecipe, ParsedIngredient

_SYSTEM_PROMPT = """You are a recipe parser. Extract structured recipe data from the provided text or URL content and return it as JSON with this shape:

{
  "title": "string or null",
  "description": "string or null",
  "image_url": "string or null",
  "source_url": "string or null",
  "author": "string or null",
  "servings": "string or null",
  "prep_time": number_of_minutes_or_null,
  "cook_time": number_of_minutes_or_null,
  "total_time": number_of_minutes_or_null,
  "cuisine": "string or null",
  "category": "string or null",
  "ingredients": [{"quantity": number_or_null, "unit": "string or null", "name": "string"}, ...],
  "steps": ["string", ...]
}

Rules:
- ingredients[].quantity: a NUMBER (e.g. 0.5, 2.0) — NOT a string. Use null if uncountable.
- ingredients[].unit: the unit of measure as a lowercase string, or null.
- ingredients[].name: the ingredient name and any notes (e.g. "flour, sifted").
- steps: ordered list of instruction strings.
- Return only valid JSON, no markdown fences.
"""


def _parse_json_recipe(data: dict) -> ParsedRecipe:
    """Build a ParsedRecipe from a parsed JSON dict."""
    ingredients: list[ParsedIngredient] = []
    for ing in data.get("ingredients") or []:
        if isinstance(ing, dict):
            ingredients.append(ParsedIngredient(
                name=ing.get("name") or "",
                quantity=float(ing["quantity"]) if ing.get("quantity") is not None else None,
                unit=ing.get("unit"),
            ))
        elif isinstance(ing, str):
            # Legacy plain-string format — best effort parse
            from app.utils.units import parse_ingredient_string
            ingredients.append(parse_ingredient_string(ing))

    return ParsedRecipe(
        title=data.get("title"),
        description=data.get("description"),
        image_url=data.get("image_url"),
        source_url=data.get("source_url"),
        author=data.get("author"),
        servings=data.get("servings"),
        prep_time=data.get("prep_time"),
        cook_time=data.get("cook_time"),
        total_time=data.get("total_time"),
        cuisine=data.get("cuisine"),
        category=data.get("category"),
        ingredients=ingredients,
        steps=data.get("steps") or [],
    )


class AIRecipeParser(RecipeParser):
    async def parse_url(self, url: str) -> ParsedRecipe:
        raise NotImplementedError(
            "AI parser not configured. Set PARSER_BACKEND=local or configure OPENAI_API_KEY."
        )

    async def parse_text(self, text: str) -> ParsedRecipe:
        raise NotImplementedError("AI parser not configured.")
