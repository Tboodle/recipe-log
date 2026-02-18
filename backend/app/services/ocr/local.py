import io
import pytesseract
from PIL import Image
from app.services.ocr.base import OCRService

class LocalOCRService(OCRService):
    async def extract_text(self, image_bytes: bytes) -> str:
        image = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(image)
