"""Talking to the model, online (cloud free tier) or offline (Ollama on this computer)."""

import asyncio
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from openai import APIConnectionError, APIError, AsyncOpenAI

from .config import Settings
from .persona import DEMO_REPLY, system_prompt

log = logging.getLogger(__name__)

Engine = Literal["online", "offline"]


class LLMError(Exception):
    """Raised when the model can't give us an answer."""


@dataclass(frozen=True)
class Target:
    engine: Engine
    base_url: str
    api_key: str
    model: str


def target_for(engine: Engine, settings: Settings) -> Target:
    if engine == "offline":
        # Ollama ignores the key, but the client library wants one.
        return Target("offline", settings.offline_base_url, "ollama", settings.offline_model)
    return Target("online", settings.llm_base_url, settings.llm_api_key or "not-needed", settings.llm_model)


def _client(t: Target) -> AsyncOpenAI:
    # Local models can take a while to load into memory on the first question.
    timeout = 300 if t.engine == "offline" else 60
    return AsyncOpenAI(api_key=t.api_key, base_url=t.base_url or None, timeout=timeout, max_retries=1)


async def _demo_stream() -> AsyncIterator[str]:
    # Stream word by word so demo mode feels the same as the real thing.
    for word in DEMO_REPLY.split(" "):
        await asyncio.sleep(0.025)
        yield word + " "


def _friendly_error(t: Target, exc: Exception) -> LLMError:
    if t.engine == "offline":
        if isinstance(exc, APIConnectionError):
            return LLMError(
                "Offline mode needs Ollama running on this computer. Install it from ollama.com, "
                f"run `ollama pull {t.model}`, then try again."
            )
        if getattr(exc, "status_code", None) == 404:
            return LLMError(f"The offline model isn't downloaded yet. Run `ollama pull {t.model}` and try again.")
        return LLMError("The offline model had a problem answering. Please try again.")

    if isinstance(exc, APIConnectionError):
        return LLMError("Couldn't reach the online model. Check your internet, or switch to Offline mode.")
    status = getattr(exc, "status_code", None)
    if status in (401, 403):
        return LLMError("The API key was rejected. Double-check LLM_API_KEY in your .env.")
    if status == 429:
        return LLMError("The free online quota is used up for now. Wait a bit, or switch to Offline mode (no limits).")
    return LLMError("The online model had a problem answering. Please try again.")


async def stream_reply(
    history: list[dict[str, Any]],
    settings: Settings,
    *,
    engine: Engine = "online",
    subject: str = "general",
    level: str = "beginner",
    mode: str = "chat",
) -> AsyncIterator[str]:
    """Yield the tutor's reply piece by piece."""
    if engine == "online" and settings.demo_mode:
        async for chunk in _demo_stream():
            yield chunk
        return

    t = target_for(engine, settings)
    prompt = system_prompt(settings.assistant_name, subject=subject, level=level, mode=mode)
    try:
        stream = await _client(t).chat.completions.create(
            model=t.model,
            messages=[{"role": "system", "content": prompt}, *history],
            temperature=settings.llm_temperature,
            stream=True,
        )
        async for event in stream:
            if not event.choices:
                continue
            delta = event.choices[0].delta.content
            if delta:
                yield delta
    except (APIError, httpx.HTTPError) as exc:
        log.warning("%s model error: %s", engine, exc)
        raise _friendly_error(t, exc) from exc
    except Exception as exc:
        log.exception("Unexpected %s model failure", engine)
        raise _friendly_error(t, exc) from exc


async def complete(prompt: str, settings: Settings, engine: Engine) -> str:
    """One short, non-streamed answer. Used for offline definitions."""
    t = target_for(engine, settings)
    try:
        res = await _client(t).chat.completions.create(
            model=t.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return (res.choices[0].message.content or "").strip()
    except Exception as exc:
        raise _friendly_error(t, exc) from exc


async def offline_status(settings: Settings) -> dict[str, Any]:
    """Is Ollama running, and is the offline model downloaded?"""
    base = settings.offline_base_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            res = await client.get(f"{base}/models")
            res.raise_for_status()
            names = [m.get("id", "") for m in res.json().get("data", [])]
    except (httpx.HTTPError, ValueError):
        return {"running": False, "model_ready": False, "models": []}
    wanted = settings.offline_model
    ready = any(n == wanted or n == f"{wanted}:latest" or n.split(":")[0] == wanted for n in names)
    return {"running": True, "model_ready": ready, "models": names}
