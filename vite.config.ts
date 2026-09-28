import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

interface DevMessage {
  position: number
  role: string
  text: string
  refused: boolean
  payload: Record<string, unknown> | null
  created_at: string
}

interface DevConversation {
  id: string
  title: string
  status: string
  last_activity_at: string
  messages: DevMessage[]
}

const conversations = new Map<string, DevConversation>()
const devUser = { id: randomUUID(), username: 'guest-local', kind: 'anonymous' }

function tokenPair() {
  return {
    access_token: 'local-development-token', refresh_token: 'local-development-refresh', token_type: 'bearer',
    access_expires_in: 86400, refresh_expires_in: 604800,
  }
}

function send(response: ServerResponse, status: number, data: unknown, message = 'Operation completed successfully.') {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ data, status: status < 400 ? 'SUCCESS' : 'FAIL', message, error_code: null, description: null }))
}

function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => { body += String(chunk) })
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) as Record<string, unknown> : {}) }
      catch (error) { reject(error) }
    })
    request.on('error', reject)
  })
}

function localApi() {
  return {
    name: 'lawful-compass-local-api',
    configureServer(server: { middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/v1/') && url.pathname !== '/health') return next()

        void (async () => {
          if (url.pathname === '/health' && request.method === 'GET') return send(response, 200, { status: 'ok' })
          if (url.pathname === '/api/v1/configs' && request.method === 'GET') return send(response, 200, {})
          if (url.pathname === '/api/v1/auth/anonymous' && request.method === 'POST') {
            devUser.username = 'guest-local'
            devUser.kind = 'anonymous'
            return send(response, 201, { ...tokenPair(), resume_token: 'local-development-resume', username: devUser.username })
          }
          if (url.pathname === '/api/v1/auth/anonymous/resume' && request.method === 'POST') {
            devUser.username = 'guest-local'
            devUser.kind = 'anonymous'
            return send(response, 200, tokenPair())
          }
          if (url.pathname === '/api/v1/auth/login' && request.method === 'POST') {
            const body = await readBody(request)
            if (!body.username || !body.password) return send(response, 401, null, 'Username and password are required.')
            devUser.username = String(body.username)
            devUser.kind = 'registered'
            return send(response, 200, tokenPair())
          }
          if (url.pathname === '/api/v1/auth/register' && request.method === 'POST') {
            const body = await readBody(request)
            if (!body.username || !body.password || body.password !== body.confirm_password) {
              return send(response, 422, null, 'Valid matching credentials are required.')
            }
            devUser.username = String(body.username)
            devUser.kind = 'registered'
            return send(response, 201, { ...tokenPair(), recovery_code: 'LOCAL-DEVELOPMENT-RECOVERY-CODE' })
          }
          if (url.pathname === '/api/v1/auth/recover' && request.method === 'POST') {
            const body = await readBody(request)
            if (!body.recovery_code || !body.password || body.password !== body.confirm_password) {
              return send(response, 422, null, 'A recovery code and matching passwords are required.')
            }
            devUser.kind = 'registered'
            return send(response, 200, {
              ...tokenPair(), username: devUser.username, recovery_code: 'LOCAL-DEVELOPMENT-RECOVERY-CODE',
            })
          }
          if (url.pathname === '/api/v1/auth/me' && request.method === 'GET') return send(response, 200, devUser)
          if (url.pathname === '/api/v1/auth/refresh' && request.method === 'POST') {
            return send(response, 200, tokenPair())
          }
          if (url.pathname === '/api/v1/conversations' && request.method === 'GET') {
            const items = [...conversations.values()].map((conversation) => ({
              id: conversation.id, title: conversation.title, status: conversation.status,
              last_activity_at: conversation.last_activity_at, message_count: conversation.messages.length,
            }))
            return send(response, 200, { items, total_count: items.length, has_more: false, page: 1, page_size: 50 })
          }
          if (url.pathname === '/api/v1/conversations' && request.method === 'POST') {
            const body = await readBody(request)
            const question = String(body.question || '').trim()
            if (!question) return send(response, 422, null, 'Question is required.')
            const id = typeof body.conversation_id === 'string' ? body.conversation_id : randomUUID()
            const now = new Date().toISOString()
            const guidance = {
              conversation_id: id, status: 'refused', clarifying_questions: [], answer: null, citations: [], refused: true,
              refusal_reason: 'no_authoritative_source',
              disclaimer: 'The local development server has no legislation corpus. Connect the Lawful Compass API for source-backed answers.',
            }
            const conversation: DevConversation = conversations.get(id) || {
              id, title: question.slice(0, 80), status: 'refused', last_activity_at: now, messages: [],
            }
            conversation.last_activity_at = now
            conversation.status = 'refused'
            conversation.messages.push(
              { position: conversation.messages.length, role: 'user', text: question, refused: false, payload: null, created_at: now },
              { position: conversation.messages.length + 1, role: 'assistant', text: 'No authoritative source is available in local development.', refused: true, payload: guidance, created_at: now },
            )
            conversations.set(id, conversation)
            return send(response, 200, guidance)
          }
          const conversationMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)$/)
          if (conversationMatch && request.method === 'GET') {
            const conversation = conversations.get(conversationMatch[1])
            return conversation ? send(response, 200, conversation) : send(response, 404, null, 'Conversation not found.')
          }
          return send(response, 404, null, 'Endpoint unavailable in local development.')
        })().catch(() => send(response, 500, null, 'Unable to complete the request.'))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
})
