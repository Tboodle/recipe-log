from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.models import User
from app.services.parser.factory import get_parser
from app.services.ocr.factory import get_ocr
from app.schemas.recipe import RecipeIn, IngredientIn, StepIn

router = APIRouter(prefix="/api/import", tags=["import"])

class URLImportRequest(BaseModel):
    url: str

def _parsed_to_recipe_in(parsed) -> RecipeIn:
    return RecipeIn(
        title=parsed.title or "Untitled Recipe",
        description=parsed.description,
        image_url=parsed.image_url,
        source_url=parsed.source_url,
        author=parsed.author,
        servings=parsed.servings,
        prep_time=parsed.prep_time,
        cook_time=parsed.cook_time,
        total_time=parsed.total_time,
        cuisine=parsed.cuisine,
        category=parsed.category,
        ingredients=[IngredientIn(name=i) for i in parsed.ingredients],
        steps=[StepIn(description=s, order=idx) for idx, s in enumerate(parsed.steps)],
    )

@router.post("/url", response_model=RecipeIn)
async def import_from_url(
    body: URLImportRequest,
    current_user: User = Depends(get_current_user),
):
    parser = get_parser()
    try:
        parsed = await parser.parse_url(body.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse recipe from URL: {e}")
    return _parsed_to_recipe_in(parsed)

@router.post("/image", response_model=RecipeIn)
async def import_from_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    image_bytes = await file.read()
    ocr = get_ocr()
    parser = get_parser()
    try:
        text = await ocr.extract_text(image_bytes)
        parsed = await parser.parse_text(text)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract recipe from image: {e}")
    return _parsed_to_recipe_in(parsed)
