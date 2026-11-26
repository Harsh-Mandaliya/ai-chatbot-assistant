import { motion } from 'framer-motion'
import type { Engine, Subject } from '../types'
import { CapIcon } from './Icons'

interface Props {
  name: string
  subject?: Subject
  quiz: boolean
  engine: Engine
  onPick: (prompt: string) => void
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function EmptyState({ name, subject, quiz, engine, onPick }: Props) {
  const topic = subject && subject.id !== 'general' ? subject.name : 'tech'
  const starters = quiz
    ? [`Quiz me on ${topic}`, `Give me a hard ${topic} question`]
    : (subject?.starters ?? [])

  return (
    <div className="empty">
      <motion.div
        className="empty-orb"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <CapIcon width={30} height={30} />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        {greeting()}! What are we studying today?
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        I'm {name}, your study buddy for code, cloud, AI and everything else in IT.
        {quiz ? ' Quiz mode is on, so I will ask the questions.' : ' Pick a starter, ask your own, or drop in a screenshot.'}
      </motion.p>
      <motion.div
        className={`mode-pill ${engine}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
      >
        {engine === 'offline'
          ? 'Offline mode: unlimited questions, unlimited images, Deep dive unlocked'
          : 'Online mode: free cloud AI, with daily limits'}
      </motion.div>
      <div className="ideas">
        {starters.map((prompt, i) => (
          <motion.button
            key={prompt}
            className="idea"
            onClick={() => onPick(prompt)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <strong>{subject && subject.id !== 'general' ? subject.name : 'Try this'}</strong>
            <span>{prompt}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
