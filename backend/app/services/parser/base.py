from abc import ABC, abstractmethod
from dataclasses import dataclass, field

@dataclass
class ParsedRecipe:
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    source_url: str | None = None
    author: str | None = None
    servings: str | None = None
    prep_time: int | None = None  # minutes
    cook_time: int | None = None  # minutes
    total_time: int | None = None  # minutes
    cuisine: str | None = None
    category: str | None = None
    ingredients: list[str] = field(default_factory=list)
    steps: list[str] = field(default_factory=list)

class RecipeParser(ABC):
    @abstractmethod
    async def parse_url(self, url: str) -> ParsedRecipe:
        """Parse a recipe from a URL."""

    @abstractmethod
    async def parse_text(self, text: str) -> ParsedRecipe:
        """Parse recipe data from raw text."""
