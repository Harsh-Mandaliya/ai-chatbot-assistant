import type { Conversation, ConversationDetail, Health, StreamEvent } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? ''

/** A random id kept in localStorage, so each browser only sees its own chats. */
function clientId(): string {
  const KEY = 'chat.clientId'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID().replaceAll('-', '')
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Private mode or storage blocked: fall back to a per-tab id.
    return (window.__chatClientId ??= crypto.randomUUID().replaceAll('-', ''))
  }
}

declare global {
  interface Window {
    __chatClientId?: string
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId(), ...init.headers },
    })
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", 0)
  }
  if (!res.ok) throw await toError(res)
  return (res.status === 204 ? undefined : await res.json()) as T
}

async function toError(res: Response): Promise<ApiError> {
  // The dev proxy answers 5xx with an empty body when the backend is down.
  if (res.status >= 502 && res.status <= 504) {
    return new ApiError("Can't reach the server. Is the backend running?", res.status)
  }
  try {
    const body = await res.json()
    return new ApiError(body?.error?.message ?? 'Something went wrong.', res.status)
  } catch {
    return new ApiError(`Request failed (${res.status}).`, res.status)
  }
}

export const api = {
  health: () => request<Health>('/api/health'),
  list: () => request<Conversation[]>('/api/conversations'),
  create: () => request<Conversation>('/api/conversations', { method: 'POST', body: '{}' }),
  get: (id: string) => request<ConversationDetail>(`/api/conversations/${id}`),
  rename: (id: string, title: string) =>
    request<Conversation>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  remove: (id: string) => request<void>(`/api/conversations/${id}`, { method: 'DELETE' }),
}

/**
 * Send a message and read the reply as it streams in (server-sent events
 * over a POST, so we parse the stream ourselves instead of using EventSource).
 */
export async function streamMessage(
  conversationId: string,
  content: string,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
  retry = false,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId() },
      body: JSON.stringify({ content, retry }),
      signal,
    })
  } catch (err) {
    if (signal.aborted) return
    throw err instanceof Error ? new ApiError("Can't reach the server. Is the backend running?", 0) : err
  }
  if (!res.ok || !res.body) throw await toError(res)

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''
      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data: '))
        if (line) onEvent(JSON.parse(line.slice(6)) as StreamEvent)
      }
    }
  } catch (err) {
    if (!signal.aborted) throw err
  }
}
