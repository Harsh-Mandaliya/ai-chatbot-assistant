import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Composer } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import { CloseIcon, MenuIcon, MoonIcon, PlusIcon, SunIcon } from './components/Icons'
import { MessageBubble } from './components/MessageBubble'
import { Sidebar } from './components/Sidebar'
import { TypingIndicator } from './components/TypingIndicator'
import { useChat } from './hooks/useChat'
import { api } from './lib/api'
import { useTheme } from './lib/theme'
import type { Health } from './types'

export default function App() {
  const chat = useChat()
  const { theme, toggle } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  const name = health?.assistant ?? 'Nova'
  const active = chat.conversations.find((c) => c.id === chat.activeId)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  // Follow the reply as it streams, unless the reader scrolled up.
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight })
  }, [chat.messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const send = (text: string) => {
    stickToBottom.current = true
    void chat.send(text)
  }

  const select = (id: string) => {
    setSidebarOpen(false)
    stickToBottom.current = true
    void chat.open(id)
  }

  const newChat = () => {
    setSidebarOpen(false)
    chat.startNew()
  }

  return (
    <div className="app">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={select}
        onNew={newChat}
        onRename={chat.rename}
        onDelete={chat.remove}
      />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setSidebarOpen(true)} aria-label="Open chat history">
            <MenuIcon />
          </button>
          <div className="topbar-title">
            <h2>{active?.title ?? 'New chat'}</h2>
            <span className={`status ${health ? (health.demo ? 'is-demo' : 'is-live') : 'is-off'}`}>
              {health ? (health.demo ? 'Demo mode' : `${name} is online`) : 'Offline'}
            </span>
          </div>
          <button className="icon-btn only-mobile" onClick={newChat} aria-label="New chat">
            <PlusIcon />
          </button>
          <button className="icon-btn theme-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </motion.span>
            </AnimatePresence>
          </button>
        </header>

        <div className="scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="thread">
            {chat.loading ? (
              <div className="thread-loading">
                <TypingIndicator />
              </div>
            ) : chat.messages.length === 0 ? (
              <EmptyState name={name} onPick={send} />
            ) : (
              chat.messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  name={name}
                  onRetry={i === chat.messages.length - 1 && !chat.streaming ? chat.retry : undefined}
                />
              ))
            )}
          </div>
        </div>

        <AnimatePresence>
          {chat.error && (
            <motion.div
              className="toast"
              role="alert"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <span>{chat.error}</span>
              <button className="icon-btn" onClick={chat.dismissError} aria-label="Dismiss">
                <CloseIcon width={16} height={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <Composer streaming={chat.streaming} onSend={send} onStop={chat.stop} />
      </main>
    </div>
  )
}
