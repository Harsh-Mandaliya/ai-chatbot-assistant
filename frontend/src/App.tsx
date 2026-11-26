import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Composer } from './components/Composer'
import { DefinePanel } from './components/DefinePanel'
import { EmptyState } from './components/EmptyState'
import { CloseIcon, MenuIcon, PlusIcon } from './components/Icons'
import { MessageBubble } from './components/MessageBubble'
import { ModeSwitch } from './components/ModeSwitch'
import { OfflineSetup } from './components/OfflineSetup'
import { SettingsMenu } from './components/SettingsMenu'
import { Sidebar } from './components/Sidebar'
import { StudyBar } from './components/StudyBar'
import { TypingIndicator } from './components/TypingIndicator'
import { useChat } from './hooks/useChat'
import { api } from './lib/api'
import { usePrefs } from './lib/theme'
import type { Engine, Engines, Health, StudyOptions, Subject } from './types'

const STUDY_KEY = 'chat.study'
const DEFAULT_STUDY: StudyOptions = { engine: 'online', subject: 'general', level: 'beginner', mode: 'chat' }

function loadStudy(): StudyOptions {
  try {
    const saved = { ...DEFAULT_STUDY, ...JSON.parse(localStorage.getItem(STUDY_KEY) ?? '{}') }
    // Deep dive only exists offline.
    if (saved.engine === 'online' && saved.level === 'deep') saved.level = 'advanced'
    return saved
  } catch {
    return DEFAULT_STUDY
  }
}

function statusLine(engine: Engine, engines: Engines | null, health: Health | null): { text: string; tone: string } {
  if (!health) return { text: 'Server not reachable', tone: 'is-off' }
  if (engine === 'offline') {
    const o = engines?.offline
    if (!o) return { text: 'Offline mode', tone: 'is-demo' }
    return o.available
      ? { text: `Offline · ${o.model} on this computer · no limits`, tone: 'is-live' }
      : { text: 'Offline · not set up yet', tone: 'is-demo' }
  }
  if (health.demo) return { text: 'Online · demo mode (add a free key)', tone: 'is-demo' }
  return { text: `Online · ${health.model}`, tone: 'is-live' }
}

export default function App() {
  const [study, setStudy] = useState<StudyOptions>(loadStudy)
  const chat = useChat(study)
  const prefs = usePrefs()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [engines, setEngines] = useState<Engines | null>(null)
  const [checking, setChecking] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  const name = health?.assistant ?? 'Nova'
  const active = chat.conversations.find((c) => c.id === chat.activeId)
  const offline = study.engine === 'offline'

  // Several checks can overlap (the offline probe can take a second), so
  // only the newest one is allowed to update the screen.
  const engineCheck = useRef(0)
  const refreshEngines = useCallback(async () => {
    const id = ++engineCheck.current
    setChecking(true)
    try {
      const next = await api.engines()
      if (id === engineCheck.current) setEngines(next)
    } catch {
      if (id === engineCheck.current) setEngines(null)
    } finally {
      if (id === engineCheck.current) setChecking(false)
    }
  }, [])

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
    api.subjects().then(setSubjects).catch(() => setSubjects([]))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshEngines()
  }, [refreshEngines])

  // After each answer, refresh how many online images are left today.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!chat.streaming) void refreshEngines()
  }, [chat.streaming, refreshEngines])

  useEffect(() => {
    try {
      localStorage.setItem(STUDY_KEY, JSON.stringify(study))
    } catch {
      /* storage unavailable */
    }
  }, [study])

  const subject = subjects.find((s) => s.id === study.subject) ?? subjects[0]
  const status = statusLine(study.engine, engines, health)
  const imagesLeft = offline ? null : engines?.online.limits.images_left_today

  // Follow the reply as it streams, unless the reader scrolled up.
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight })
  }, [chat.messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const send = (text: string, images: string[] = []) => {
    stickToBottom.current = true
    void chat.send(text, images)
  }

  const switchEngine = (engine: Engine) => {
    setStudy((s) => ({ ...s, engine, level: engine === 'online' && s.level === 'deep' ? 'advanced' : s.level }))
    void refreshEngines()
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
        engine={study.engine}
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
            <span className={`status ${status.tone}`}>{status.text}</span>
          </div>
          <ModeSwitch engine={study.engine} engines={engines} onChange={switchEngine} />
          <button className="icon-btn only-mobile" onClick={newChat} aria-label="New chat">
            <PlusIcon />
          </button>
          <DefinePanel engine={study.engine} />
          <SettingsMenu theme={prefs.theme} font={prefs.font} onTheme={prefs.setTheme} onFont={prefs.setFont} />
        </header>

        <div className="scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="thread">
            {offline && engines && !engines.offline.available && (
              <OfflineSetup offline={engines.offline} onCheck={() => void refreshEngines()} checking={checking} />
            )}
            {chat.loading ? (
              <div className="thread-loading">
                <TypingIndicator />
              </div>
            ) : chat.messages.length === 0 ? (
              <EmptyState
                name={name}
                subject={subject}
                quiz={study.mode === 'quiz'}
                engine={study.engine}
                onPick={send}
              />
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
          <Composer
            streaming={chat.streaming}
            onSend={send}
            onStop={chat.stop}
            imagesLeft={imagesLeft}
            onError={chat.showError}
          />
        </div>
      </main>
    </div>
  )
}
