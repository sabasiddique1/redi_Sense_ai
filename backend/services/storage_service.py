from pathlib import Path
from typing import Tuple

from fastapi import UploadFile
from pdfminer.high_level import extract_text as pdf_extract_text


UPLOAD_ROOT = Path("storage/uploads")


def ensure_storage():
  UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


async def save_upload(file: UploadFile) -> Path:
  ensure_storage()
  dest = UPLOAD_ROOT / file.filename
  contents = await file.read()
  dest.write_bytes(contents)
  return dest


def extract_text_from_file(path: Path) -> str:
  suffix = path.suffix.lower()
  if suffix == ".pdf":
    return pdf_extract_text(str(path))
  else:
    return path.read_text(encoding="utf-8", errors="ignore")


async def handle_report_upload(file: UploadFile) -> Tuple[Path, str]:
  saved = await save_upload(file)
  text = extract_text_from_file(saved)
  return saved, text

