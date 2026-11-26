import type { Engine, Engines } from '../types'
import { CloudIcon, LaptopIcon } from './Icons'

interface Props {
  engine: Engine
  engines: Engines | null
  onChange: (engine: Engine) => void
}

/** Online (free cloud model, with limits) vs Offline (model on this computer, no limits). */
export function ModeSwitch({ engine, engines, onChange }: Props) {
  const online = engines?.online
  const offline = engines?.offline

  const onlineTip = online
    ? `Online: ${online.model}. Up to ${online.limits.messages_per_minute} messages a minute and ${online.limits.images_per_day} images a day.`
    : 'Online: free cloud model'
  const offlineTip = offline
    ? offline.available
      ? `Offline: ${offline.model} on this computer. No limits, works without internet.`
      : `Offline: needs Ollama and the ${offline.model} model on this computer.`
    : 'Offline: model on this computer'

  return (
    <div className="mode-switch" role="radiogroup" aria-label="Mode">
      <button
        role="radio"
        aria-checked={engine === 'online'}
        className={engine === 'online' ? 'is-active' : ''}
        onClick={() => onChange('online')}
        title={onlineTip}
      >
        <CloudIcon width={15} height={15} />
        <span>Online</span>
      </button>
      <button
        role="radio"
        aria-checked={engine === 'offline'}
        className={engine === 'offline' ? 'is-active' : ''}
        onClick={() => onChange('offline')}
        title={offlineTip}
      >
        <LaptopIcon width={15} height={15} />
        <span>Offline</span>
        {offline && <i className={`dot ${offline.available ? 'ok' : 'off'}`} aria-hidden />}
      </button>
    </div>
  )
}
