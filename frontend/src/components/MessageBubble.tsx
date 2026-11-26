import { motion } from 'framer-motion'
import { memo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { Message } from '../types'
import { CodeBlock } from './CodeBlock'
import { CheckIcon, CopyIcon, RetryIcon, SparkIcon } from './Icons'
import { TypingIndicator } from './TypingIndicator'

interface Props {
  message: Message
  name: string
  onRetry?: () => void
}

const markdownComponents: Components = {
  a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export const MessageBubble = memo(function MessageBubble({ message, name, onRetry }: Props) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const waiting = message.status === 'streaming' && !message.content

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <motion.div
      className={`row ${isUser ? 'row-user' : 'row-bot'}`}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      {!isUser && (
        <div className="avatar" aria-hidden>
          <SparkIcon width={16} height={16} />
        </div>
      )}

      <div className="bubble-wrap">
        {!isUser && <span className="author">{name}</span>}
        <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-bot'} ${message.status === 'error' ? 'is-error' : ''}`}>
          {waiting ? (
            <TypingIndicator />
          ) : isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className={`markdown ${message.status === 'streaming' ? 'is-streaming' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!waiting && message.status !== 'streaming' && (
          <div className="meta">
            <span>{isUser && message.status === 'error' ? 'Not sent' : time(message.created_at)}</span>
            {!isUser && message.status !== 'error' && (
              <button className="meta-btn" onClick={copy} aria-label="Copy reply">
                {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
            {message.status === 'error' && onRetry && (
              <button className="meta-btn" onClick={onRetry}>
                <RetryIcon width={14} height={14} /> Try again
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
})
