"""Text extraction for CV uploads (PDF, docx, plain text)."""
import io
import logging

logger = logging.getLogger("ai-service.extract")

_IMPORTS_OK = False
try:
    from pypdf import PdfReader

    _IMPORTS_OK = True
except ImportError:  # pragma: no cover
    PdfReader = None  # type: ignore[assignment]


async def extract_text(filename: str, data: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        if not _IMPORTS_OK:
            raise RuntimeError("pypdf is not installed; cannot extract PDF text")
        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()
    if lower.endswith(".docx"):
        try:
            from docx import Document

            document = Document(io.BytesIO(data))
            return "\n".join(p.text for p in document.paragraphs if p.text).strip()
        except ImportError:  # pragma: no cover
            raise RuntimeError("python-docx is not installed; cannot extract DOCX text")
    if lower.endswith((".txt", ".md")):
        return data.decode("utf-8", errors="strict").strip()
    raise ValueError("Unsupported CV format. Use a text-based PDF, DOCX, TXT or Markdown file.")
