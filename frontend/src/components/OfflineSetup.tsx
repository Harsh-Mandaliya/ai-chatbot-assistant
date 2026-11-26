import { motion } from 'framer-motion'
import type { Engines } from '../types'
import { LaptopIcon, RetryIcon } from './Icons'

interface Props {
  offline: Engines['offline']
  onCheck: () => void
  checking: boolean
}

/** Shown in Offline mode until Ollama and the model are ready on this computer. */
export function OfflineSetup({ offline, onCheck, checking }: Props) {
  return (
    <motion.div className="offline-setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="offline-setup-icon">
        <LaptopIcon width={22} height={22} />
      </div>
      <div className="offline-setup-body">
        <h3>{offline.running ? 'Almost there: download the offline model' : 'Set up Offline mode (one time)'}</h3>
        <p>
          Offline mode runs the AI on your own computer: no internet, no key, no limits on messages, images or depth.
        </p>
        <ol>
          {!offline.running && (
            <li>
              Install <strong>Ollama</strong> from{' '}
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
                ollama.com/download
              </a>{' '}
              and open it.
            </li>
          )}
          <li>
            In a terminal, run <code>ollama pull {offline.model}</code> (about 3 GB, downloaded once).
          </li>
          <li>Click "Check again" below.</li>
        </ol>
        <button className="chip" onClick={onCheck} disabled={checking}>
          <RetryIcon width={14} height={14} /> {checking ? 'Checking...' : 'Check again'}
        </button>
      </div>
    </motion.div>
  )
}
