from recipe_scrapers import scrape_me, WebsiteNotImplementedError, NoSchemaFoundInWildMode
from app.services.parser.base import RecipeParser, ParsedRecipe, ParsedIngredient
from app.utils.units import parse_ingredient_string

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

        ingredients_raw = safe(scraper.ingredients) or []
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
            ingredients=[parse_ingredient_string(i) for i in ingredients_raw],
            steps=steps,
        )

    async def parse_text(self, text: str) -> ParsedRecipe:  # noqa: C901
        import re

        lines = [l.strip() for l in text.splitlines() if l.strip()]

        # ── Regexes ─────────────────────────────────────────────────────────
        time_re = {
            "prep":  re.compile(r"prep\s+time[^\d]*(\d+)\s*min", re.I),
            "cook":  re.compile(r"cook\s+time[^\d]*(\d+)\s*min", re.I),
            "total": re.compile(r"total\s+time[^\d]*(\d+)\s*min", re.I),
        }
        serving_re = re.compile(r"(?:serves?|servings?|yields?)\s*[:\-]?\s*(\d+)", re.I)

        # Ingredient: line that starts with a number/fraction/specific measure word
        MEASURE_WORDS = (
            r"fine\s|freshly\s|torn\s|ground\s|pinch\s|dash\s"
            r"|handful\s|kosher\s|coarse\s|large\s|small\s|medium\s"
        )
        ingredient_re = re.compile(
            rf"^(?:\d[\d/½¼¾⅓⅔⅛⅜⅝⅞]*\s|(?:{MEASURE_WORDS}))",
            re.I,
        )
        # Prose noise: lines clearly not ingredients (contain sentence markers)
        prose_re = re.compile(r"[!?]|Sorry|Mom|version|summer|delicious|elevated", re.I)
        # Step: starts with "1." / "1)" / "Step 1"
        step_start_re = re.compile(r"^(?:step\s+)?\d+[.)]\s+\S", re.I)
        # Section header to skip
        section_re = re.compile(
            r"^(ingredients?|instructions?|directions?|method|steps?|notes?)$", re.I
        )

        # ── Collect metadata from any line ──────────────────────────────────
        prep_time = cook_time = total_time = servings = None
        for line in lines:
            for key, pat in time_re.items():
                m = pat.search(line)
                if m:
                    val = int(m.group(1))
                    if key == "prep" and prep_time is None:
                        prep_time = val
                    elif key == "cook" and cook_time is None:
                        cook_time = val
                    elif key == "total" and total_time is None:
                        total_time = val
            if servings is None:
                m = serving_re.search(line)
                if m:
                    servings = m.group(1)

        # ── Title: collect up to 2 pre-metadata lines, join if first is short ──
        title = "Untitled Recipe"
        title_parts: list[str] = []
        for line in lines:
            if len(line) < 5:
                continue  # skip noise like "ey,"
            if any(p.search(line) for p in time_re.values()):
                break  # stop at timing metadata line
            if ingredient_re.match(line):
                break  # stop at first ingredient line
            clean = re.sub(r"\s*[|\\]+\s*$", "", line).strip()
            if clean:
                title_parts.append(clean)
            if len(title_parts) == 2:
                break  # have enough candidates

        if len(title_parts) >= 2 and len(title_parts[0]) < 35:
            title = f"{title_parts[0]} {title_parts[1]}"
        elif title_parts:
            title = title_parts[0]

        # ── Pass 2: classify each line ───────────────────────────────────────
        ingredients: list[ParsedIngredient] = []
        steps: list[str] = []
        step_buf: list[str] = []
        in_steps = False

        def flush_step():
            if step_buf:
                steps.append(" ".join(step_buf))
                step_buf.clear()

        for line in lines:
            if len(line) < 4 or section_re.match(line):
                continue
            if any(p.search(line) for p in time_re.values()):
                continue  # skip timing metadata lines

            if step_start_re.match(line):
                flush_step()
                in_steps = True
                step_buf.append(re.sub(r"^(?:step\s+)?\d+[.)]\s+", "", line, flags=re.I))
                continue

            if in_steps and step_buf:
                # Continuation of current step (not an ingredient line)
                if not ingredient_re.match(line):
                    step_buf.append(line)
                    continue
                else:
                    flush_step()
                    in_steps = False

            if ingredient_re.match(line) and not prose_re.search(line):
                ingredients.append(parse_ingredient_string(line))
                continue

        flush_step()

        return ParsedRecipe(
            title=title,
            servings=servings,
            prep_time=prep_time,
            cook_time=cook_time,
            total_time=total_time,
            ingredients=ingredients,
            steps=steps,
        )
