import { isValidElement, useRef, useState, type ReactNode } from 'react'
import { CheckIcon, CopyIcon } from './Icons'

/** Pulls "python" out of the "hljs language-python" class rehype-highlight adds. */
function languageOf(children: ReactNode): string {
  if (!isValidElement<{ className?: string }>(children)) return ''
  const match = /language-([\w+#-]+)/.exec(children.props.className ?? '')
  return match ? match[1] : ''
}

export function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const lang = languageOf(children)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.current?.innerText ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="code">
      <div className="code-head">
        <span>{lang || 'code'}</span>
        <button onClick={copy} aria-label="Copy code">
          {copied ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={ref}>{children}</pre>
    </div>
  )
}
