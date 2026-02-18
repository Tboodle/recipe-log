import io
import pytesseract
from PIL import Image
from app.services.ocr.base import OCRService

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass  # HEIC support unavailable; non-HEIC images still work


class LocalOCRService(OCRService):
    async def extract_text(self, image_bytes: bytes) -> str:
        image = Image.open(io.BytesIO(image_bytes))
        # Normalise: pytesseract rejects formats it doesn't recognise (e.g. HEIF).
        # Re-encoding through PNG gives it a format string it accepts.
        if image.format not in ("PNG", "JPEG", "TIFF", "BMP", "GIF", "PPM"):
            buf = io.BytesIO()
            image.convert("RGB").save(buf, format="PNG")
            buf.seek(0)
            image = Image.open(buf)
        elif image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        return pytesseract.image_to_string(image)
