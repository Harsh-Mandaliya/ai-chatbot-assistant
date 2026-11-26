import asyncio
import logging
from collections.abc import AsyncIterator

from openai import APIError, AsyncOpenAI

from .config import Settings
from .persona import DEMO_REPLY, system_prompt

log = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when the model provider can't give us an answer."""


def _client(settings: Settings) -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.llm_api_key or "not-needed",
        base_url=settings.llm_base_url or None,
        timeout=60,
        max_retries=1,
    )


async def _demo_stream() -> AsyncIterator[str]:
    # Stream word by word so demo mode feels the same as the real thing.
    for word in DEMO_REPLY.split(" "):
        await asyncio.sleep(0.025)
        yield word + " "


async def stream_reply(history: list[dict[str, str]], settings: Settings) -> AsyncIterator[str]:
    """Yield the assistant's reply piece by piece."""
    if settings.demo_mode:
        async for chunk in _demo_stream():
            yield chunk
        return

    messages = [{"role": "system", "content": system_prompt(settings.assistant_name)}, *history]
    try:
        stream = await _client(settings).chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            temperature=settings.llm_temperature,
            stream=True,
        )
        async for event in stream:
            if not event.choices:
                continue
            delta = event.choices[0].delta.content
            if delta:
                yield delta
    except APIError as exc:
        log.warning("LLM provider error: %s", exc)
        status = getattr(exc, "status_code", None)
        if status == 401:
            raise LLMError("The API key was rejected. Double-check LLM_API_KEY in your .env.") from exc
        if status == 429:
            raise LLMError("The model provider is rate limiting us. Give it a few seconds and try again.") from exc
        raise LLMError("The model provider had a problem answering. Please try again.") from exc
    except Exception as exc:  # network errors, timeouts
        log.exception("Unexpected LLM failure")
        raise LLMError("Couldn't reach the model provider. Check your connection and LLM_BASE_URL.") from exc
