export type Role = 'user' | 'assistant'

export type Engine = 'online' | 'offline'

export interface Message {
  id: string
  role: Role
  content: string
  engine?: Engine
  /** Image URLs: /api/uploads/... from the server, or data: URLs before upload. */
  images?: string[]
  created_at: string
  /** Client-side only: set while a reply is still streaming in, or failed. */
  status?: 'streaming' | 'error'
}

export interface Conversation {
  id: string
  title: string
  engine: 'online' | 'offline'
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

export interface Subject {
  id: string
  name: string
  starters: string[]
}

export interface Definition {
  title: string
  summary: string
  url: string | null
}

export type Level = 'beginner' | 'advanced' | 'deep'
export type Mode = 'chat' | 'quiz'

export interface StudyOptions {
  engine: Engine
  subject: string
  level: Level
  mode: Mode
}

export interface Engines {
  online: {
    available: boolean
    demo: boolean
    model: string
    limits: {
      messages_per_minute: number
      images_per_day: number
      images_left_today: number
      levels: Level[]
    }
  }
  offline: {
    available: boolean
    running: boolean
    model_ready: boolean
    model: string
    limits: null
    levels: Level[]
  }
}
