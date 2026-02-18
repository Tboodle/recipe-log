from abc import ABC, abstractmethod

class OCRService(ABC):
    @abstractmethod
    async def extract_text(self, image_bytes: bytes) -> str:
        """Extract text from image bytes. Returns raw text string."""
