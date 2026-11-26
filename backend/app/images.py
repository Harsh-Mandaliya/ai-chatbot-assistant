"""Saving uploaded screenshots and photos, and feeding them back to the model."""

import base64
import binascii
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, status

from .config import Settings

DATA_URL = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$")
FILE_NAME = re.compile(r"^[0-9a-f]{32}\.(png|jpg|webp|gif)$")
MIME = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp", "gif": "image/gif"}

# The bytes each format starts with, so a renamed text file can't sneak in.
MAGIC = {
    "png": (b"\x89PNG",),
    "jpg": (b"\xff\xd8\xff",),
    "webp": (b"RIFF",),
    "gif": (b"GIF87a", b"GIF89a"),
}


def save_images(data_urls: list[str], settings: Settings) -> list[str]:
    """Decode, check and store images. Returns the stored file names."""
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    names = []
    for url in data_urls:
        match = DATA_URL.match(url)
        if not match:
            raise HTTPException(422, "Only PNG, JPG, WebP or GIF images are supported.")
        ext = "jpg" if match.group(1) in ("jpeg", "jpg") else match.group(1)
        try:
            raw = base64.b64decode(match.group(2), validate=False)
        except (binascii.Error, ValueError):
            raise HTTPException(422, "That image looks damaged. Try another one.")
        if len(raw) > settings.max_image_mb * 1024 * 1024:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Images can be up to {settings.max_image_mb} MB each."
            )
        if not raw.startswith(MAGIC[ext]):
            raise HTTPException(422, "That file isn't a real image.")
        name = f"{uuid.uuid4().hex}.{ext}"
        (settings.upload_dir / name).write_bytes(raw)
        names.append(name)
    return names


def path_for(name: str, settings: Settings) -> Path | None:
    if not FILE_NAME.match(name):
        return None
    path = settings.upload_dir / name
    return path if path.is_file() else None


def as_data_url(name: str, settings: Settings) -> str | None:
    path = path_for(name, settings)
    if path is None:
        return None
    ext = name.rsplit(".", 1)[1]
    return f"data:{MIME[ext]};base64,{base64.b64encode(path.read_bytes()).decode()}"
