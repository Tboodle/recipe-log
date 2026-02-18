from app.services.ocr.base import OCRService

class AIOCRService(OCRService):
    async def extract_text(self, image_bytes: bytes) -> str:
        raise NotImplementedError("AI OCR not configured. Set PARSER_BACKEND=local or configure OPENAI_API_KEY.")
