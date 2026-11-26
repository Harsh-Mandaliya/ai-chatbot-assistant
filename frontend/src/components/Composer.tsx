import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { SendIcon, StopIcon } from './Icons'

const MAX = 4000

interface Props {
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export function Composer({ streaming, onSend, onStop }: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow with the content, up to a limit set in CSS.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const submit = () => {
    if (streaming || !text.trim() || text.length > MAX) return
    onSend(text)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const left = MAX - text.length

  return (
    <div className="composer-wrap">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message..."
          aria-label="Message"
          autoFocus
        />
        {streaming ? (
          <button type="button" className="send is-stop" onClick={onStop} aria-label="Stop replying">
            <StopIcon />
          </button>
        ) : (
          <button type="submit" className="send" disabled={!text.trim() || left < 0} aria-label="Send message">
            <SendIcon />
          </button>
        )}
      </form>
      <p className="composer-hint">
        {left < 300 ? (
          <span className={left < 0 ? 'over' : ''}>{left} characters left</span>
        ) : (
          <>
            <kbd>Enter</kbd> to send, <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
          </>
        )}
      </p>
    </div>
  )
}
