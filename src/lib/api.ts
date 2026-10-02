import { session } from './session'
import type {
  AnonymousSession,
  ApiEnvelope,
  AttachmentDetail,
  AttachmentUpload,
  BlogPostDetail,
  BlogPostSummary,
  CitationDetail,
  ChecklistItemState,
  ConversationDetail,
  ConversationSummary,
  CurrentUser,
  DocumentDetail,
  DocumentDownload,
  FeedbackReceipt,
  GeneratedDocumentSummary,
  GuidanceResponse,
  Paginated,
  RecoveryResult,
  RegistrationResult,
  SpeechPayload,
  TokenPair,
  TranscriptionPayload,
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

async function parseResponse<T>(response: Response, allowNull = false): Promise<T> {
  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError(response.ok ? 'The server returned an invalid response.' : 'Unable to complete the request.', response.status)
  }

  if (!response.ok || body.status === 'FAIL' || (!allowNull && body.data === null)) {
    const fields = body.errors?.reduce<Record<string, string>>((result, error) => {
      result[error.field.split('.').at(-1) || error.field] = error.message
      return result
    }, {})
    throw new ApiError(body.description || body.message || 'Unable to complete the request.', response.status, body.error_code, fields)
  }
  return body.data as T
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
  allowNull?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = false, retry = true, allowNull = false, headers, ...init } = options
  const requestHeaders = new Headers(headers)
  if (init.body && !(init.body instanceof FormData)) requestHeaders.set('Content-Type', 'application/json')
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
  return parseResponse<T>(response, allowNull)
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
  logout: () => request<null>('/api/v1/auth/logout', {
    method: 'POST', allowNull: true, body: JSON.stringify({ refresh_token: session.refresh() || '' }),
  }),
  me: () => request<CurrentUser>('/api/v1/auth/me', { auth: true }),
  listConversations: (page = 1, pageSize = 50) => request<Paginated<ConversationSummary>>(
    `/api/v1/conversations?page=${page}&page_size=${pageSize}`, { auth: true },
  ),
  getConversation: (id: string) => request<ConversationDetail>(`/api/v1/conversations/${encodeURIComponent(id)}`, { auth: true }),
  postTurn: (question: string, conversationId?: string | null, inputMode: 'text' | 'voice' = 'text', attachmentIds: string[] = []) => request<GuidanceResponse>('/api/v1/conversations', {
    method: 'POST', auth: true, body: JSON.stringify({ question, conversation_id: conversationId || null, input_mode: inputMode, attachment_ids: attachmentIds }),
  }),
  getCitation: (nodeId: string) => request<CitationDetail>(`/api/v1/citations/${encodeURIComponent(nodeId)}`),
  uploadAttachment: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<AttachmentUpload>('/api/v1/attachments', { method: 'POST', auth: true, body })
  },
  getAttachment: (id: string) => request<AttachmentDetail>(`/api/v1/attachments/${encodeURIComponent(id)}`, { auth: true }),
  deleteAttachment: (id: string) => request<null>(`/api/v1/attachments/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true, allowNull: true }),
  transcribe: (audio: Blob) => {
    const body = new FormData()
    body.append('audio', audio, 'recording.webm')
    return request<TranscriptionPayload>('/api/v1/speech/transcriptions', { method: 'POST', auth: true, body })
  },
  getMessageSpeech: (conversationId: string, position: number) => request<SpeechPayload>(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages/${position}/speech`, { auth: true },
  ),
  updateChecklistItem: (conversationId: string, position: number, index: number, checked: boolean) => request<ChecklistItemState>(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages/${position}/checklist/${index}`,
    { method: 'PUT', auth: true, body: JSON.stringify({ checked }) },
  ),
  submitFeedback: (rating: number, comment: string | null, conversationId: string | null) => request<FeedbackReceipt>('/api/v1/feedback', {
    method: 'POST', auth: true, body: JSON.stringify({ rating, comment: comment || null, conversation_id: conversationId }),
  }),
  listDocuments: (conversationId?: string | null) => request<Paginated<GeneratedDocumentSummary>>(
    `/api/v1/documents?page=1&page_size=100${conversationId ? `&conversation_id=${encodeURIComponent(conversationId)}` : ''}`, { auth: true },
  ),
  getDocument: (id: string) => request<DocumentDetail>(`/api/v1/documents/${encodeURIComponent(id)}`, { auth: true }),
  downloadDocument: (id: string) => request<DocumentDownload>(`/api/v1/documents/${encodeURIComponent(id)}/download`, { auth: true }),
  deleteDocument: (id: string) => request<null>(`/api/v1/documents/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true, allowNull: true }),
  listBlogPosts: (page = 1, pageSize = 20) => request<Paginated<BlogPostSummary>>(`/api/v1/blog/posts?page=${page}&page_size=${pageSize}`),
  getBlogPost: (slug: string) => request<BlogPostDetail>(`/api/v1/blog/posts/${encodeURIComponent(slug)}`),
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) return `Cannot reach the Lawful Compass service at ${API_BASE_URL}.`
  return 'Something went wrong. Please try again.'
}
