import logging
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException, Query, status

from ..schemas import Definition, SubjectOut
from ..subjects import SUBJECTS

router = APIRouter(prefix="/api", tags=["study"])
log = logging.getLogger(__name__)

WIKI = "https://en.wikipedia.org"
# Wikipedia asks API clients to identify themselves.
HEADERS = {"User-Agent": "ai-chatbot-assistant/2.0 (study app; https://github.com/Harsh-Mandaliya/ai-chatbot-assistant)"}


@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects():
    return [SubjectOut(id=s.id, name=s.name, starters=list(s.starters)) for s in SUBJECTS]


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


@router.get("/define", response_model=Definition)
async def define(term: str = Query(min_length=2, max_length=80)):
    """A quick plain-language definition from Wikipedia (free, no key needed)."""
    term = " ".join(term.split())
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=8, follow_redirects=True) as client:
            page = None
            # Try the term as-is first, then nudge the search towards computing
            # when the plain word is ambiguous ("closure", "heap", "python"...).
            for query in (term, f"{term} computing"):
                title = await _search(client, query)
                page = await _summary(client, title) if title else None
                if page and page.get("type") != "disambiguation":
                    break
                page = None
    except httpx.HTTPError as exc:
        log.warning("Wikipedia lookup failed: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't reach Wikipedia right now. Try again in a bit.")

    if not page or not page.get("extract"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Couldn't find a definition for \"{term}\".")
    return Definition(
        title=page.get("title", term),
        summary=page["extract"],
        url=page.get("content_urls", {}).get("desktop", {}).get("page"),
    )
