export type Role = 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  created_at: string
  /** Client-side only: set while a reply is still streaming in, or failed. */
  status?: 'streaming' | 'error'
}

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ConversationDetail extends Conversation {
  messages: Message[]
}

export interface Health {
  status: string
  assistant: string
  model: string
  demo: boolean
}

export type StreamEvent =
  | { type: 'start'; userMessage: Message; title: string }
  | { type: 'token'; content: string }
  | { type: 'done'; message: Message | null }
  | { type: 'error'; message: string }
