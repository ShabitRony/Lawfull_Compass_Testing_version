export interface ApiEnvelope<T> {
  data: T | null
  status: 'SUCCESS' | 'WARNING' | 'FAIL'
  message: string
  error_code: string | null
  description: string | null
  errors?: ValidationError[]
}

export interface ValidationError {
  field: string
  code: string
  message: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  access_expires_in: number
  refresh_expires_in: number
}

export interface AnonymousSession extends TokenPair {
  resume_token: string
  username: string
}

export interface RegistrationResult extends TokenPair {
  recovery_code: string
}

export interface RecoveryResult extends RegistrationResult {
  username: string
}

export interface CurrentUser {
  id: string
  username: string
  kind: 'anonymous' | 'registered' | string
}

export interface ConversationSummary {
  id: string
  title: string | null
  status: string
  last_activity_at: string
  message_count: number
}

export interface Paginated<T> {
  items: T[]
  total_count: number
  has_more: boolean
  page: number
  page_size: number
}

export interface ConversationMessage {
  position: number
  role: string
  text: string
  refused: boolean
  payload: Record<string, unknown> | null
  created_at: string
}

export interface ConversationDetail {
  id: string
  title: string | null
  status: string
  last_activity_at: string
  messages: ConversationMessage[]
}

export interface ItemCitation {
  node_id: string
  cited_text: string
}

export interface AnswerItem {
  text: string
  grounded: boolean
  citations?: ItemCitation[]
}

export interface StructuredAnswer {
  summary: string
  evidence_needed?: AnswerItem[] | null
  checklist?: AnswerItem[] | null
  withheld_count: number
}

export interface Citation {
  node_id: string
  citation: string
  document_title: string
  jurisdiction: string
  document_type: string | null
  heading_path: string | null
  snippet: string
  source_code: string | null
  source_name: string | null
  canonical_url: string | null
  artifact_url: string | null
}

export interface CitationDetail {
  node_id: string
  citation: string
  document_title: string
  jurisdiction: string
  official_identifier: string
  document_type: string | null
  heading: string | null
  heading_path: string | null
  text: string
  source_url: string | null
  effective_from: string | null
  effective_to: string | null
  previous_node_id: string | null
  next_node_id: string | null
}

export interface ClarifyingQuestion {
  id: string
  kind: 'choice' | 'text' | 'date'
  question: string
  options: string[]
  why: string
}

export interface GuidanceResponse {
  conversation_id: string
  status: 'needs_clarification' | 'answered' | 'refused'
  clarifying_questions?: ClarifyingQuestion[]
  answer?: StructuredAnswer | null
  citations?: Citation[]
  refused: boolean
  refusal_reason?: string | null
  disclaimer?: string | null
}

export interface CitationSelection {
  summary: Citation
  detail?: CitationDetail
}
