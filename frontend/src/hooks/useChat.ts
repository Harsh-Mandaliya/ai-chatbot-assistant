import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, streamMessage } from '../lib/api'
import type { Conversation, Message, StudyOptions } from '../types'

const tempId = () => `tmp-${Math.random().toString(36).slice(2)}`
const now = () => new Date().toISOString()

export function useChat(study: StudyOptions) {
  // Read the latest study options at send time without re-creating callbacks.
  const studyRef = useRef(study)
  useEffect(() => {
    studyRef.current = study
  }, [study])

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refreshList = useCallback(async () => {
    try {
      setConversations(await api.list())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your chats.')
    }
  }, [])

  useEffect(() => {
    // Initial load of the sidebar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshList()
  }, [refreshList])

  const open = useCallback(async (id: string) => {
    abortRef.current?.abort()
    setActiveId(id)
    setError(null)
    setLoading(true)
    try {
      const detail = await api.get(id)
      setMessages(detail.messages)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open that chat.')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [])

  const startNew = useCallback(() => {
    abortRef.current?.abort()
    setActiveId(null)
    setMessages([])
    setError(null)
  }, [])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const send = useCallback(
    async (text: string, retry = false) => {
      const content = text.trim()
      if (!content || streaming) return
      setError(null)

      const userTemp: Message = { id: tempId(), role: 'user', content, created_at: now() }
      const replyTemp: Message = { id: tempId(), role: 'assistant', content: '', created_at: now(), status: 'streaming' }
      setMessages((m) => [...m, userTemp, replyTemp])
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller
      const patchReply = (fn: (m: Message) => Message) =>
        setMessages((list) => list.map((m) => (m.id === replyTemp.id ? fn(m) : m)))

      try {
        let id = activeId
        if (!id) {
          const convo = await api.create()
          id = convo.id
          setActiveId(id)
          setConversations((list) => [convo, ...list])
        }
        const convoId = id

        await streamMessage(
          convoId,
          content,
          (event) => {
            switch (event.type) {
              case 'start':
                setMessages((list) => list.map((m) => (m.id === userTemp.id ? event.userMessage : m)))
                setConversations((list) =>
                  list.map((c) => (c.id === convoId ? { ...c, title: event.title, updated_at: now() } : c)),
                )
                break
              case 'token':
                patchReply((m) => ({ ...m, content: m.content + event.content }))
                break
              case 'done':
                patchReply((m) => (event.message ? { ...event.message } : { ...m, status: undefined }))
                break
              case 'error':
                patchReply((m) => ({ ...m, status: 'error', content: m.content || event.message }))
                break
            }
          },
          controller.signal,
          studyRef.current,
          retry,
        )
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
        // Drop the empty reply bubble and mark the question as not sent, so it can be retried.
        setMessages((list) =>
          list
            .filter((m) => m.id !== replyTemp.id || m.content)
            .map((m) => (m.id === userTemp.id ? { ...m, status: 'error' } : m)),
        )
        setError(message)
      } finally {
        // A stopped reply keeps whatever text arrived.
        setMessages((list) =>
          list
            .filter((m) => !(m.id === replyTemp.id && !m.content))
            .map((m) => (m.id === replyTemp.id && m.status === 'streaming' ? { ...m, status: undefined } : m)),
        )
        setStreaming(false)
        abortRef.current = null
        setConversations((list) => [...list].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)))
      }
    },
    [activeId, streaming],
  )

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    setMessages((list) => {
      const idx = list.lastIndexOf(lastUser)
      return list.slice(0, idx)
    })
    void send(lastUser.content, true)
  }, [messages, send])

  const rename = useCallback(async (id: string, title: string) => {
    try {
      const updated = await api.rename(id, title)
      setConversations((list) => list.map((c) => (c.id === id ? { ...c, title: updated.title } : c)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not rename that chat.')
    }
  }, [])

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.remove(id)
        setConversations((list) => list.filter((c) => c.id !== id))
        if (id === activeId) startNew()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not delete that chat.')
      }
    },
    [activeId, startNew],
  )

  return {
    conversations,
    activeId,
    messages,
    streaming,
    loading,
    error,
    dismissError: () => setError(null),
    open,
    startNew,
    send,
    stop,
    retry,
    rename,
    remove,
  }
}
