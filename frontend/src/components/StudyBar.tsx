import type { Level, StudyOptions, Subject } from '../types'
import { CapIcon, LockIcon, QuizIcon } from './Icons'

interface Props {
  subjects: Subject[]
  study: StudyOptions
  onChange: (next: StudyOptions) => void
}

const LEVELS: { id: Level; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'deep', label: 'Deep dive' },
]

/** Subject, depth and quiz controls that sit just above the message box. */
export function StudyBar({ subjects, study, onChange }: Props) {
  const quiz = study.mode === 'quiz'
  const offline = study.engine === 'offline'

  const pickLevel = (level: Level) => {
    // Deep dive lives in Offline mode, so picking it switches over.
    if (level === 'deep' && !offline) onChange({ ...study, level, engine: 'offline' })
    else onChange({ ...study, level })
  }

  return (
    <div className="studybar" role="group" aria-label="Study options">
      <label className="subject-select">
        <CapIcon width={16} height={16} />
        <select
          value={study.subject}
          onChange={(e) => onChange({ ...study, subject: e.target.value })}
          aria-label="Subject"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="segmented small" aria-label="Explanation level">
        {LEVELS.map((l) => {
          const locked = l.id === 'deep' && !offline
          return (
            <button
              key={l.id}
              className={`${study.level === l.id ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
              onClick={() => pickLevel(l.id)}
              aria-pressed={study.level === l.id}
              title={locked ? 'Deep dive is an Offline mode feature. Click to switch to Offline.' : undefined}
            >
              {locked && <LockIcon width={12} height={12} />}
              {l.label}
            </button>
          )
        })}
      </div>

      <button
        className={`chip ${quiz ? 'is-active' : ''}`}
        onClick={() => onChange({ ...study, mode: quiz ? 'chat' : 'quiz' })}
        aria-pressed={quiz}
        title="Quiz mode: one multiple-choice question at a time"
      >
        <QuizIcon width={15} height={15} /> Quiz {quiz ? 'on' : 'mode'}
      </button>
    </div>
  )
}
