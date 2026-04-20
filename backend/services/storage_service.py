from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from pdfminer.high_level import extract_text as pdfminer_extract_text

try:
  from docx import Document
except ImportError:  # pragma: no cover - optional until dependencies are installed
  Document = None

try:
  from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional until dependencies are installed
  PdfReader = None

from backend.config import get_settings


settings = get_settings()
UPLOAD_ROOT = settings.storage_path / "uploads"
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}
MAX_FILENAME_LENGTH = 120


@dataclass
class SavedUpload:
  original_filename: str
  mime_type: str | None
  size_bytes: int
  path: Path
  extracted_text: str


def ensure_storage() -> None:
  UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


def _sanitize_filename(filename: str) -> str:
  safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", filename or "report")
  safe_name = safe_name.strip("._")
  if not safe_name:
    safe_name = "report"
  return safe_name[:MAX_FILENAME_LENGTH]


def _validate_extension(filename: str) -> None:
  suffix = Path(filename).suffix.lower()
  if suffix not in ALLOWED_EXTENSIONS:
    raise HTTPException(
      status_code=400,
      detail="Unsupported file type. Allowed types: PDF, TXT, MD, DOCX.",
    )


async def save_upload(file: UploadFile) -> tuple[Path, int]:
  ensure_storage()
  safe_name = _sanitize_filename(file.filename or "report")
  _validate_extension(safe_name)

  destination = UPLOAD_ROOT / f"{uuid4().hex}_{safe_name}"
  size_bytes = 0

  with destination.open("wb") as target:
    while True:
      chunk = await file.read(1024 * 1024)
      if not chunk:
        break
      size_bytes += len(chunk)
      if size_bytes > settings.upload_max_bytes:
        destination.unlink(missing_ok=True)
        raise HTTPException(
          status_code=413,
          detail=f"File exceeds {settings.max_upload_size_mb}MB limit.",
        )
      target.write(chunk)

  return destination, size_bytes


def _extract_pdf_text(path: Path) -> str:
  text = pdfminer_extract_text(str(path)).strip()
  if text:
    return text

  if PdfReader is None:
    return ""

  reader = PdfReader(str(path))
  pages = [(page.extract_text() or "").strip() for page in reader.pages]
  return "\n".join(page for page in pages if page)


def _extract_docx_text(path: Path) -> str:
  if Document is None:
    raise HTTPException(
      status_code=500,
      detail="DOCX support is unavailable until backend dependencies are installed.",
    )
  document = Document(str(path))
  return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text)


def extract_text_from_file(path: Path) -> str:
  suffix = path.suffix.lower()
  if suffix == ".pdf":
    text = _extract_pdf_text(path)
  elif suffix == ".docx":
    text = _extract_docx_text(path)
  else:
    text = path.read_text(encoding="utf-8", errors="ignore")

  extracted = text.strip()
  if not extracted:
    raise HTTPException(status_code=422, detail="No readable text found in uploaded file.")
  return extracted


async def handle_report_upload(file: UploadFile) -> SavedUpload:
  saved_path, size_bytes = await save_upload(file)
  text = extract_text_from_file(saved_path)

  return SavedUpload(
    original_filename=file.filename or "report",
    mime_type=file.content_type,
    size_bytes=size_bytes,
    path=saved_path,
    extracted_text=text,
  )
