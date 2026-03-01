import json

import httpx
from openai import AsyncOpenAI
from recipe_scrapers import scrape_html

from app.core.config import settings
from app.services.parser.base import ParsedIngredient, ParsedRecipe, RecipeParser
from app.utils.units import parse_ingredient_string

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
    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def _ask(self, user_content: str) -> str:
        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=2000,
        )
        return response.choices[0].message.content or "{}"

    async def parse_text(self, text: str) -> ParsedRecipe:
        raw = await self._ask(text)
        return _parse_json_recipe(json.loads(raw))

    async def parse_url(self, url: str) -> ParsedRecipe:
        """Try recipe-scrapers first; fall back to AI if scraper can't parse it."""
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                resp.raise_for_status()
                html = resp.text

            scraper = scrape_html(html, org_url=url)
            ingredients = scraper.ingredients() or []
            steps_raw = scraper.instructions_list() or []
            if not steps_raw and scraper.instructions():
                steps_raw = [scraper.instructions()]

            if ingredients or steps_raw:
                def _mins(v: int | None) -> int | None:
                    return int(v) if v else None

                return ParsedRecipe(
                    title=scraper.title() or None,
                    image_url=scraper.image() or None,
                    source_url=url,
                    author=scraper.author() or None,
                    servings=str(scraper.yields()) if scraper.yields() else None,
                    prep_time=_mins(scraper.prep_time()),
                    cook_time=_mins(scraper.cook_time()),
                    total_time=_mins(scraper.total_time()),
                    ingredients=[parse_ingredient_string(i) for i in ingredients],
                    steps=steps_raw,
                )
        except Exception:
            pass

        # Fall back to AI
        raw = await self._ask(f"Extract the recipe from this URL's content: {url}")
        result = _parse_json_recipe(json.loads(raw))
        result.source_url = url
        return result
