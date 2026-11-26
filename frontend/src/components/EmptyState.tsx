import { motion } from 'framer-motion'
import { SparkIcon } from './Icons'

const IDEAS = [
  { title: 'Plan a weekend', prompt: 'Help me plan a relaxed two-day trip from Ahmedabad on a small budget.' },
  { title: 'Explain something', prompt: 'Explain how the internet actually gets data to my phone, like I am curious but not technical.' },
  { title: 'Write with me', prompt: 'Help me write a short, friendly message asking my manager for Friday off.' },
  { title: 'Debug my code', prompt: 'Why does my React useEffect run twice in development?' },
]

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function EmptyState({ name, onPick }: { name: string; onPick: (prompt: string) => void }) {
  return (
    <div className="empty">
      <motion.div
        className="empty-orb"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <SparkIcon width={30} height={30} />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        {greeting()}! I'm {name}.
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        Ask me anything, or pick one of these to get going.
      </motion.p>
      <div className="ideas">
        {IDEAS.map((idea, i) => (
          <motion.button
            key={idea.title}
            className="idea"
            onClick={() => onPick(idea.prompt)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <strong>{idea.title}</strong>
            <span>{idea.prompt}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
