import { session } from './session'
import type {
  AnonymousSession,
  ApiEnvelope,
  CitationDetail,
  ConversationDetail,
  ConversationSummary,
  CurrentUser,
  GuidanceResponse,
  Paginated,
  RecoveryResult,
  RegistrationResult,
  TokenPair,
} from '../types/api'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string | null,
    public fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let refreshRequest: Promise<TokenPair> | null = null

async function parseResponse<T>(response: Response): Promise<T> {
  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError(response.ok ? 'The server returned an invalid response.' : 'Unable to complete the request.', response.status)
  }

  if (!response.ok || body.status === 'FAIL' || body.data === null) {
    const fields = body.errors?.reduce<Record<string, string>>((result, error) => {
      result[error.field.split('.').at(-1) || error.field] = error.message
      return result
    }, {})
    throw new ApiError(body.description || body.message || 'Unable to complete the request.', response.status, body.error_code, fields)
  }
  return body.data
}

async function refreshAccessToken(): Promise<TokenPair> {
  const refreshToken = session.refresh()
  if (!refreshToken) throw new ApiError('Your session has expired. Please sign in again.', 401)

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const tokens = await parseResponse<TokenPair>(response)
  session.setTokens(tokens)
  return tokens
}

interface RequestOptions extends RequestInit {
  auth?: boolean
  retry?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = false, retry = true, headers, ...init } = options
  const requestHeaders = new Headers(headers)
  if (init.body) requestHeaders.set('Content-Type', 'application/json')
  if (auth && session.access()) requestHeaders.set('Authorization', `Bearer ${session.access()}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: requestHeaders })
  if (response.status === 401 && auth && retry && session.refresh()) {
    try {
      refreshRequest ||= refreshAccessToken().finally(() => { refreshRequest = null })
      await refreshRequest
      return request<T>(path, { ...options, retry: false })
    } catch (error) {
      session.clearTokens()
      throw error
    }
  }
  return parseResponse<T>(response)
}

export const api = {
  createAnonymous: () => request<AnonymousSession>('/api/v1/auth/anonymous', { method: 'POST' }),
  resumeAnonymous: (resumeToken: string) => request<TokenPair>('/api/v1/auth/anonymous/resume', {
    method: 'POST', body: JSON.stringify({ resume_token: resumeToken }),
  }),
  login: (username: string, password: string) => request<TokenPair>('/api/v1/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  }),
  register: (username: string, password: string, confirmPassword: string) => request<RegistrationResult>('/api/v1/auth/register', {
    method: 'POST', auth: Boolean(session.access()), body: JSON.stringify({ username, password, confirm_password: confirmPassword }),
  }),
  recover: (recoveryCode: string, password: string, confirmPassword: string) => request<RecoveryResult>('/api/v1/auth/recover', {
    method: 'POST', body: JSON.stringify({ recovery_code: recoveryCode, password, confirm_password: confirmPassword }),
  }),
  me: () => request<CurrentUser>('/api/v1/auth/me', { auth: true }),
  listConversations: (page = 1, pageSize = 50) => request<Paginated<ConversationSummary>>(
    `/api/v1/conversations?page=${page}&page_size=${pageSize}`, { auth: true },
  ),
  getConversation: (id: string) => request<ConversationDetail>(`/api/v1/conversations/${encodeURIComponent(id)}`, { auth: true }),
  postTurn: (question: string, conversationId?: string | null) => request<GuidanceResponse>('/api/v1/conversations', {
    method: 'POST', auth: true, body: JSON.stringify({ question, conversation_id: conversationId || null }),
  }),
  getCitation: (nodeId: string) => request<CitationDetail>(`/api/v1/citations/${encodeURIComponent(nodeId)}`),
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) return `Cannot reach the Lawful Compass service at ${API_BASE_URL}.`
  return 'Something went wrong. Please try again.'
}
