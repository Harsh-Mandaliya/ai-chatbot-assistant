import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Composer } from './components/Composer'
import { DefinePanel } from './components/DefinePanel'
import { EmptyState } from './components/EmptyState'
import { CloseIcon, MenuIcon, PlusIcon } from './components/Icons'
import { MessageBubble } from './components/MessageBubble'
import { SettingsMenu } from './components/SettingsMenu'
import { Sidebar } from './components/Sidebar'
import { StudyBar } from './components/StudyBar'
import { TypingIndicator } from './components/TypingIndicator'
import { useChat } from './hooks/useChat'
import { api } from './lib/api'
import { usePrefs } from './lib/theme'
import type { Health, StudyOptions, Subject } from './types'

const STUDY_KEY = 'chat.study'
const DEFAULT_STUDY: StudyOptions = { subject: 'general', level: 'beginner', mode: 'chat' }

function loadStudy(): StudyOptions {
  try {
    return { ...DEFAULT_STUDY, ...JSON.parse(localStorage.getItem(STUDY_KEY) ?? '{}') }
  } catch {
    return DEFAULT_STUDY
  }
}

export default function App() {
  const [study, setStudy] = useState<StudyOptions>(loadStudy)
  const chat = useChat(study)
  const prefs = usePrefs()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  const name = health?.assistant ?? 'Nova'
  const active = chat.conversations.find((c) => c.id === chat.activeId)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
    api.subjects().then(setSubjects).catch(() => setSubjects([]))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STUDY_KEY, JSON.stringify(study))
    } catch {
      /* storage unavailable */
    }
  }, [study])

  const subject = subjects.find((s) => s.id === study.subject) ?? subjects[0]

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
              {health ? (health.demo ? 'Demo mode' : `${name} is ready to help`) : 'Offline'}
            </span>
          </div>
          <button className="icon-btn only-mobile" onClick={newChat} aria-label="New chat">
            <PlusIcon />
          </button>
          <DefinePanel />
          <SettingsMenu theme={prefs.theme} font={prefs.font} onTheme={prefs.setTheme} onFont={prefs.setFont} />
        </header>

        <div className="scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="thread">
            {chat.loading ? (
              <div className="thread-loading">
                <TypingIndicator />
              </div>
            ) : chat.messages.length === 0 ? (
              <EmptyState name={name} subject={subject} quiz={study.mode === 'quiz'} onPick={send} />
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

        <div className="dock">
          {subjects.length > 0 && <StudyBar subjects={subjects} study={study} onChange={setStudy} />}
          <Composer streaming={chat.streaming} onSend={send} onStop={chat.stop} />
        </div>
      </main>
    </div>
  )
}
