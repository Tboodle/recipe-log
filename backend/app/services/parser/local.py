from recipe_scrapers import scrape_me, WebsiteNotImplementedError, NoSchemaFoundInWildMode
from app.services.parser.base import RecipeParser, ParsedRecipe

def _duration_to_minutes(value) -> int | None:
    """Convert recipe-scrapers time value (int minutes) to int or None."""
    try:
        v = int(value)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None

class LocalRecipeParser(RecipeParser):
    async def parse_url(self, url: str) -> ParsedRecipe:
        try:
            scraper = scrape_me(url, wild_mode=True)
        except Exception as e:
            raise ValueError(f"Could not scrape URL: {e}") from e

        def safe(fn):
            try:
                result = fn()
                return result if result else None
            except Exception:
                return None

        ingredients = safe(scraper.ingredients) or []
        steps_raw = safe(scraper.instructions_list) or []
        steps = []
        for s in steps_raw:
            if isinstance(s, dict):
                steps.append(s.get("text") or s.get("name") or str(s))
            else:
                steps.append(str(s))

        return ParsedRecipe(
            title=safe(scraper.title),
            description=safe(scraper.description),
            image_url=safe(scraper.image),
            source_url=url,
            author=safe(scraper.author),
            servings=str(safe(scraper.yields)) if safe(scraper.yields) else None,
            prep_time=_duration_to_minutes(safe(scraper.prep_time)),
            cook_time=_duration_to_minutes(safe(scraper.cook_time)),
            total_time=_duration_to_minutes(safe(scraper.total_time)),
            cuisine=safe(scraper.cuisine),
            category=safe(scraper.category),
            ingredients=ingredients,
            steps=steps,
        )

    async def parse_text(self, text: str) -> ParsedRecipe:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        return ParsedRecipe(
            title=lines[0] if lines else "Untitled",
            ingredients=lines[1:] if len(lines) > 1 else [],
        )
