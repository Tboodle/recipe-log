import io
import pytesseract
from PIL import Image, ImageFilter, ImageOps
from app.services.ocr.base import OCRService

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass  # HEIC support unavailable; non-HEIC images still work


def _preprocess(image: Image.Image) -> Image.Image:
    """Improve image quality before OCR: grayscale → auto-contrast → sharpen.

    Grayscale removes colour noise; autocontrast stretches the histogram so text
    becomes darker and the background whiter (equivalent to GIMP's auto white
    balance / curves); sharpening firms up character edges.
    """
    image = image.convert("L")
    image = ImageOps.autocontrast(image, cutoff=2)
    image = image.filter(ImageFilter.SHARPEN)
    return image


class LocalOCRService(OCRService):
    async def extract_text(self, image_bytes: bytes) -> str:
        image = Image.open(io.BytesIO(image_bytes))
        # Normalise: pytesseract rejects formats it doesn't recognise (e.g. HEIF).
        if image.format not in ("PNG", "JPEG", "TIFF", "BMP", "GIF", "PPM"):
            buf = io.BytesIO()
            image.convert("RGB").save(buf, format="PNG")
            buf.seek(0)
            image = Image.open(buf)

        image = _preprocess(image)
        # psm 6: treat image as a single uniform block of text — works well for
        # recipe cards and single-column cookbook pages.
        return pytesseract.image_to_string(image, config="--psm 6 --oem 3")
