import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from .config import get_settings
from .db import init_db
from .routes import chat, conversations, study

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger("chatbot")

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if settings.demo_mode:
        log.warning("No LLM_API_KEY set, running in demo mode. See backend/.env.example.")
    yield


app = FastAPI(title="AI Study Assistant", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Client-Id"],
)


# Every error leaves the API in the same shape: {"error": {"message": ...}}
@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail}},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
    message = str(first.get("msg", "Invalid request")).removeprefix("Value error, ")
    return JSONResponse(status_code=422, content={"error": {"message": message, "field": field}})


@app.exception_handler(Exception)
async def unexpected_error(_: Request, exc: Exception):
    log.error("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"error": {"message": "Something went wrong on our side."}})


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "assistant": settings.assistant_name,
        "model": settings.llm_model,
        "demo": settings.demo_mode,
    }


app.include_router(conversations.router)
app.include_router(chat.router)
app.include_router(study.router)
