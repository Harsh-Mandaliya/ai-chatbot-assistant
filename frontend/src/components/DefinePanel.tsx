import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import type { Definition, Engine } from '../types'
import { BookIcon, SearchIcon } from './Icons'
import { Popover } from './Popover'
import { TypingIndicator } from './TypingIndicator'

/** Quick definitions: Wikipedia when online, the local model when offline. */
export function DefinePanel({ engine }: { engine: Engine }) {
  const [term, setTerm] = useState('')
  const [result, setResult] = useState<Definition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const lookUp = async (e: FormEvent) => {
    e.preventDefault()
    if (term.trim().length < 2) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await api.define(term.trim(), engine))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lookup failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover label="Quick definition" icon={<BookIcon />} className="define">
      {() => (
        <>
          <p className="popover-label">Quick definition</p>
          <form className="search define-search" onSubmit={lookUp}>
            <SearchIcon />
            <input
              autoFocus
              value={term}
              maxLength={80}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. REST API, recursion, Docker"
              aria-label="Term to define"
            />
          </form>
          <div className="define-body">
            {busy && <TypingIndicator />}
            {error && <p className="define-error">{error}</p>}
            {result && (
              <>
                <h4>{result.title}</h4>
                <p>{result.summary}</p>
                {result.url && (
                  <a href={result.url} target="_blank" rel="noreferrer">
                    Read more on Wikipedia
                  </a>
                )}
              </>
            )}
            {!busy && !error && !result && <p className="define-hint">
                {engine === 'offline' ? 'Answered by the model on this computer.' : 'Definitions come from Wikipedia.'}
              </p>}
          </div>
        </>
      )}
    </Popover>
  )
}
