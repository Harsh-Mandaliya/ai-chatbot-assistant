import logging
from typing import Literal
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_db
from ..images import path_for
from ..llm import LLMError, complete, offline_status
from ..schemas import Definition, SubjectOut
from ..subjects import SUBJECTS
from .chat import online_images_used_today

router = APIRouter(prefix="/api", tags=["study"])
log = logging.getLogger(__name__)

WIKI = "https://en.wikipedia.org"
# Wikipedia asks API clients to identify themselves.
HEADERS = {"User-Agent": "ai-chatbot-assistant/2.0 (study app; https://github.com/Harsh-Mandaliya/ai-chatbot-assistant)"}


@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects():
    return [SubjectOut(id=s.id, name=s.name, starters=list(s.starters)) for s in SUBJECTS]


@router.get("/engines")
async def engines(
    x_client_id: str = Header(default=""),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """What each mode can do right now, and what limits apply."""
    used = online_images_used_today(db, x_client_id) if x_client_id else 0
    local = await offline_status(settings)
    return {
        "online": {
            "available": True,
            "demo": settings.demo_mode,
            "model": settings.llm_model,
            "limits": {
                "messages_per_minute": settings.rate_limit_per_minute,
                "images_per_day": settings.online_images_per_day,
                "images_left_today": max(settings.online_images_per_day - used, 0),
                "levels": ["beginner", "advanced"],
            },
        },
        "offline": {
            "available": local["running"] and local["model_ready"],
            "running": local["running"],
            "model_ready": local["model_ready"],
            "model": settings.offline_model,
            "limits": None,
            "levels": ["beginner", "advanced", "deep"],
        },
    }


@router.get("/uploads/{name}")
def uploaded_image(name: str, settings: Settings = Depends(get_settings)):
    path = path_for(name, settings)
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found.")
    return FileResponse(path, headers={"Cache-Control": "private, max-age=31536000, immutable"})


async def _search(client: httpx.AsyncClient, query: str) -> str | None:
    res = await client.get(
        f"{WIKI}/w/api.php",
        params={"action": "query", "list": "search", "srsearch": query, "srlimit": 1, "format": "json"},
    )
    res.raise_for_status()
    hits = res.json().get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None


async def _summary(client: httpx.AsyncClient, title: str) -> dict | None:
    res = await client.get(f"{WIKI}/api/rest_v1/page/summary/{quote(title.replace(' ', '_'), safe='')}")
    return res.json() if res.status_code == 200 else None


async def _wikipedia(term: str) -> Definition | None:
    async with httpx.AsyncClient(headers=HEADERS, timeout=8, follow_redirects=True) as client:
        # Try the term as-is first, then nudge the search towards computing
        # when the plain word is ambiguous ("closure", "heap", "python"...).
        for query in (term, f"{term} computing"):
            title = await _search(client, query)
            page = await _summary(client, title) if title else None
            if page and page.get("type") != "disambiguation" and page.get("extract"):
                return Definition(
                    title=page.get("title", term),
                    summary=page["extract"],
                    url=page.get("content_urls", {}).get("desktop", {}).get("page"),
                )
    return None


async def _local_definition(term: str, settings: Settings) -> Definition:
    text = await complete(
        f"Define the IT / computer science term \"{term}\" for an engineering student in 2 to 4 plain sentences. "
        "No heading, no preamble. If it isn't a tech term, say so in one sentence.",
        settings,
        "offline",
    )
    return Definition(title=term, summary=text, url=None)


@router.get("/define", response_model=Definition)
async def define(
    term: str = Query(min_length=2, max_length=80),
    engine: Literal["online", "offline"] = "online",
    settings: Settings = Depends(get_settings),
):
    """A quick definition: Wikipedia when online, the local model when offline."""
    term = " ".join(term.split())

    if engine == "offline":
        try:
            return await _local_definition(term, settings)
        except LLMError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))

    try:
        found = await _wikipedia(term)
    except httpx.HTTPError as exc:
        log.warning("Wikipedia lookup failed: %s", exc)
        # No internet? Ask the local model instead, if there is one.
        try:
            return await _local_definition(term, settings)
        except LLMError:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't reach Wikipedia right now. Try again in a bit.")

    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Couldn't find a definition for \"{term}\".")
    return found
