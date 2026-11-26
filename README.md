# AI Chatbot Assistant

A friendly, fast chat assistant with a clean web interface. Ask it anything and the reply streams in word by word, the way a real conversation feels. Your chats are saved, so you can come back to them, rename them or clear them out whenever you like.

The assistant (called **Nova** by default) is tuned to talk like a thoughtful friend: warm, direct and to the point, without the stiff "As an AI language model..." tone.

## Features

**Chat experience**
- Replies stream in live, with a typing indicator while the assistant thinks
- Stop a reply halfway through, copy any answer, or retry one that failed
- Markdown in replies: lists, tables, links and code blocks
- Chat history in a sidebar, grouped by day, with search, rename and delete
- Light and dark mode (follows your system setting until you pick one)
- Works well on phones: the sidebar becomes a slide-out drawer
- Smooth, subtle animations that respect "reduce motion"

**Backend**
- REST API built with FastAPI, plus a streaming endpoint using server-sent events
- Conversations and messages stored with SQLAlchemy (SQLite out of the box, Postgres if you want)
- Input validation on every request, with clear error messages in one consistent shape
- Per-client rate limiting, so nobody can flood the model
- Works with any OpenAI-compatible provider: Groq, OpenRouter, OpenAI, or a local Ollama
- A demo mode that runs without any API key, handy for trying the UI
- Secrets live in `.env`, which is never committed

## Tech stack

| Part      | Tools |
|-----------|-------|
| Frontend  | React 19, TypeScript, Vite, Framer Motion, react-markdown |
| Backend   | Python, FastAPI, SQLAlchemy, Pydantic, OpenAI Python SDK |
| Database  | SQLite (default) or PostgreSQL |
| Models    | Any OpenAI-compatible API (Llama 3.3 on Groq by default) |

## Getting started

You'll need **Python 3.11+** and **Node.js 20+**.

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env      # then open .env and add your key
uvicorn app.main:app --reload --port 8000
```

Get a free API key from [Groq](https://console.groq.com/keys) and paste it into `LLM_API_KEY` in `backend/.env`. If you'd rather run everything locally, install [Ollama](https://ollama.com), pull a model and set:

```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
```

Leave the key empty and the server starts in demo mode, so you can still click around.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to the backend on port 8000.

### Useful commands

| Command | What it does |
|---------|--------------|
| `npm run build` | Typecheck and build the frontend into `frontend/dist` |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | ESLint |
| `pip install -r requirements-dev.txt && pytest` | Run the backend tests (from `backend/`) |

## Configuration

All settings live in `backend/.env` (see `backend/.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_BASE_URL` | Groq | Any OpenAI-compatible endpoint |
| `LLM_API_KEY` | empty | Your provider key. Empty means demo mode |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Model name at your provider |
| `LLM_TEMPERATURE` | `0.8` | Higher is more playful, lower is more focused |
| `ASSISTANT_NAME` | `Nova` | What the assistant calls itself |
| `DATABASE_URL` | `sqlite:///./chat.db` | Where chats are stored |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed web origins |
| `RATE_LIMIT_PER_MINUTE` | `20` | Messages per client per minute |
| `MAX_HISTORY_MESSAGES` | `20` | How much of the chat the model sees |

Want a different personality? Edit `backend/app/persona.py`.

## API

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/health` | Server status, model name and demo flag |
| `GET` | `/api/conversations` | List your chats, newest first |
| `POST` | `/api/conversations` | Start a new chat |
| `GET` | `/api/conversations/{id}` | A chat with all its messages |
| `PATCH` | `/api/conversations/{id}` | Rename a chat |
| `DELETE` | `/api/conversations/{id}` | Delete a chat |
| `POST` | `/api/conversations/{id}/messages` | Send a message, get the reply as a stream |

Each browser sends a random `X-Client-Id` header that it keeps in local storage, so visitors only ever see their own chats. Interactive docs are at http://localhost:8000/docs while the server runs.

## Project structure

```
backend/
  app/
    main.py          app setup, CORS, error handling
    config.py        settings read from .env
    persona.py       the assistant's voice and system prompt
    llm.py           streaming replies from the model provider
    rate_limit.py    sliding-window rate limiter
    models.py        Conversation and Message tables
    schemas.py       request and response validation
    routes/          conversation and chat endpoints
  tests/             API tests
frontend/
  src/
    App.tsx          layout and top bar
    hooks/useChat.ts chat state, streaming and history
    lib/             API client and theme handling
    components/      sidebar, messages, composer, empty state
    styles.css       design tokens, light and dark themes
```

## Author

**Harsh Mandaliya**
GitHub: [@Harsh-Mandaliya](https://github.com/Harsh-Mandaliya)

© 2026 Harsh Mandaliya. All rights reserved.
