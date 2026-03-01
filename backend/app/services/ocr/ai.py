from __future__ import annotations

import base64
from io import BytesIO

from openai import AsyncOpenAI
from PIL import Image

from app.core.config import settings
from app.services.ocr.base import OCRService

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass  # HEIC support optional


def _to_jpeg_b64(image_bytes: bytes) -> str:
    """Convert any PIL-supported image (including HEIC) to a base64 JPEG string."""
    img = Image.open(BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode()


class AIOCRService(OCRService):
    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def extract_text(self, image_bytes: bytes) -> str:
        b64 = _to_jpeg_b64(image_bytes)
        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Please transcribe all text visible in this recipe image. "
                                "Include the recipe title, all ingredients with quantities, "
                                "and all instructions. Preserve the original wording as closely "
                                "as possible. Return only the transcribed text, no commentary."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{b64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=2000,
        )
        return response.choices[0].message.content or ""
