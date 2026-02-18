from app.core.config import settings
from app.services.ocr.base import OCRService

def get_ocr() -> OCRService:
    if settings.parser_backend == "ai":
        from app.services.ocr.ai import AIOCRService
        return AIOCRService()
    from app.services.ocr.local import LocalOCRService
    return LocalOCRService()
