import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState, type FormEvent } from 'react'
import type { Conversation } from '../types'
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from './Icons'

interface Props {
  engine: 'online' | 'offline'
  conversations: Conversation[]
  activeId: string | null
  open: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

/** Groups chats into Today / Yesterday / This week / Older. */
function groupByDate(items: Conversation[]) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const day = 86_400_000
  const groups: Record<string, Conversation[]> = {}
  for (const c of items) {
    const t = new Date(c.updated_at).getTime()
    const label =
      t >= startOfDay.getTime()
        ? 'Today'
        : t >= startOfDay.getTime() - day
          ? 'Yesterday'
          : t >= startOfDay.getTime() - 6 * day
            ? 'This week'
            : 'Older'
    ;(groups[label] ??= []).push(c)
  }
  return Object.entries(groups)
}

export function Sidebar({ engine, conversations, activeId, open, onClose, onSelect, onNew, onRename, onDelete }: Props) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groupByDate(q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations)
  }, [conversations, query])

  const startEdit = (c: Conversation) => {
    setEditing(c.id)
    setDraft(c.title)
  }

  const saveEdit = (e: FormEvent) => {
    e.preventDefault()
    if (editing && draft.trim()) onRename(editing, draft.trim())
    setEditing(null)
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Chat history">
        <div className="sidebar-head">
          <button className="btn btn-new" onClick={onNew}>
            <PlusIcon /> New chat
          </button>
          <button className="icon-btn only-mobile" onClick={onClose} aria-label="Close sidebar">
            <CloseIcon />
          </button>
        </div>

        <label className="search">
          <SearchIcon />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" />
        </label>

        <p className={`history-mode ${engine}`}>
          {engine === 'offline' ? 'Offline chats' : 'Online chats'}
          <span>{engine === 'offline' ? 'on this computer' : 'cloud AI'}</span>
        </p>

        <nav className="history">
          {conversations.length === 0 && (
            <p className="history-empty">
              Your {engine === 'offline' ? 'offline' : 'online'} chats will show up here.
            </p>
          )}
          {conversations.length > 0 && groups.length === 0 && <p className="history-empty">No chats match "{query}".</p>}

          {groups.map(([label, items]) => (
            <section key={label}>
              <h3 className="history-label">{label}</h3>
              <ul>
                <AnimatePresence initial={false}>
                  {items.map((c) => (
                    <motion.li
                      key={c.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`history-item ${c.id === activeId ? 'is-active' : ''}`}
                    >
                      {editing === c.id ? (
                        <form onSubmit={saveEdit} className="rename">
                          <input
                            autoFocus
                            value={draft}
                            maxLength={120}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                            aria-label="Chat title"
                          />
                          <button type="submit" className="icon-btn" aria-label="Save title">
                            <CheckIcon />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button className="history-title" onClick={() => onSelect(c.id)} title={c.title}>
                            {c.title}
                          </button>
                          <div className="history-actions">
                            <button className="icon-btn" onClick={() => startEdit(c)} aria-label={`Rename ${c.title}`}>
                              <PencilIcon width={15} height={15} />
                            </button>
                            <button
                              className="icon-btn danger"
                              onClick={() => confirm(`Delete "${c.title}"? This can't be undone.`) && onDelete(c.id)}
                              aria-label={`Delete ${c.title}`}
                            >
                              <TrashIcon width={15} height={15} />
                            </button>
                          </div>
                        </>
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </nav>

        <footer className="sidebar-foot">
          Made by{' '}
          <a href="https://github.com/Harsh-Mandaliya" target="_blank" rel="noreferrer">
            Harsh Mandaliya
          </a>
        </footer>
      </aside>
    </>
  )
}
