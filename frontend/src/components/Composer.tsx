import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import { toDataUrl } from '../lib/images'
import { CloseIcon, ImageIcon, SendIcon, StopIcon } from './Icons'

const MAX = 4000
const PER_MESSAGE = 6

interface Props {
  streaming: boolean
  onSend: (text: string, images: string[]) => void
  onStop: () => void
  /** How many more images may be sent. null means unlimited (offline). */
  imagesLeft?: number | null
  onError: (message: string) => void
}

export function Composer({ streaming, onSend, onStop, imagesLeft, onError }: Props) {
  const [text, setText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Grow with the content, up to a limit set in CSS.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    // Only show a scrollbar once the text is taller than the box can grow.
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden'
  }, [text])

  const room = Math.min(PER_MESSAGE, imagesLeft ?? Infinity) - images.length

  const addFiles = async (files: File[]) => {
    const pictures = files.filter((f) => f.type.startsWith('image/'))
    if (pictures.length === 0) return
    if (room <= 0) {
      onError(
        imagesLeft != null && imagesLeft - images.length <= 0
          ? "That's today's online image limit. Switch to Offline mode for unlimited uploads."
          : `You can attach up to ${PER_MESSAGE} images per message.`,
      )
      return
    }
    try {
      const urls = await Promise.all(pictures.slice(0, room).map(toDataUrl))
      setImages((list) => [...list, ...urls])
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't add that image.")
    }
  }

  const submit = () => {
    if (streaming || (!text.trim() && images.length === 0) || text.length > MAX) return
    onSend(text, images)
    setText('')
    setImages([])
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files]
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault()
      void addFiles(files)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void addFiles([...e.dataTransfer.files])
  }

  const left = MAX - text.length
  const canSend = (text.trim().length > 0 || images.length > 0) && left >= 0

  return (
    <div
      className={`composer-wrap ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <AnimatePresence initial={false}>
          {images.length > 0 && (
            <motion.div
              className="attachments"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              {images.map((src, i) => (
                <div key={src.slice(-32) + i} className="thumb">
                  <img src={src} alt={`Attachment ${i + 1}`} />
                  <button
                    type="button"
                    onClick={() => setImages((list) => list.filter((_, j) => j !== i))}
                    aria-label={`Remove attachment ${i + 1}`}
                  >
                    <CloseIcon width={12} height={12} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="composer-row">
          <button
            type="button"
            className="attach"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach screenshots or photos"
            title="Attach screenshots or photos (or paste / drop them here)"
          >
            <ImageIcon />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => {
              void addFiles([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
          <textarea
            ref={ref}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={images.length ? 'Ask about the image (optional)...' : 'Ask a study question...'}
            aria-label="Message"
            autoFocus
          />
          {streaming ? (
            <button type="button" className="send is-stop" onClick={onStop} aria-label="Stop replying">
              <StopIcon />
            </button>
          ) : (
            <button type="submit" className="send" disabled={!canSend} aria-label="Send message">
              <SendIcon />
            </button>
          )}
        </div>
      </form>
      <p className="composer-hint">
        {left < 300 ? (
          <span className={left < 0 ? 'over' : ''}>{left} characters left</span>
        ) : (
          <>
            <kbd>Enter</kbd> to send, <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line ·{' '}
            {imagesLeft === null
              ? 'unlimited images'
              : imagesLeft !== undefined && `${imagesLeft} image${imagesLeft === 1 ? '' : 's'} left today`}
          </>
        )}
      </p>
    </div>
  )
}
