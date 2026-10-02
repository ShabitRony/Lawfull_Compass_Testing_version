export interface ApiEnvelope<T> {
  data: T | null
  status: 'SUCCESS' | 'WARNING' | 'FAIL'
  message: string
  error_code: string | null
  description: string | null
  errors?: ValidationError[]
}

export interface ValidationError { field: string; code: string; message: string }

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  access_expires_in: number
  refresh_expires_in: number
}

export interface AnonymousSession extends TokenPair { resume_token: string; username: string }
export interface RegistrationResult extends TokenPair { recovery_code: string }
export interface RecoveryResult extends RegistrationResult { username: string }
export interface CurrentUser { id: string; username: string; kind: 'anonymous' | 'registered' | string }

export type ConversationTag = 'traffic-camera-infringements' | 'council-infringements' | 'parking-fines' | 'debt-fine-enforcement' | 'other'

export interface ConversationSummary {
  id: string
  title: string | null
  tag: ConversationTag | null
  status: string
  created_at: string
  last_activity_at: string
  message_count: number
  human_reviewed: boolean
  reviewed_at: string | null
}

export interface Paginated<T> { items: T[]; total_count: number; has_more: boolean; page: number; page_size: number }

export interface AttachmentSummary {
  id: string
  filename: string
  media_type: string
  page_count: number
  extraction: string
  character_count: number
  created_at: string
}

export interface AttachmentUpload extends AttachmentSummary { text_preview: string }
export interface AttachmentDetail extends AttachmentSummary {
  conversation_id: string | null
  pages: string[]
  url: string
  url_expires_in_seconds: number
}

export interface ConversationMessage {
  position: number
  role: string
  text: string
  payload: Record<string, unknown> | null
  input_mode: string | null
  attachments?: AttachmentSummary[]
  created_at: string
}

export interface ConversationDetail {
  id: string
  title: string | null
  tag: ConversationTag | null
  status: string
  created_at: string
  last_activity_at: string
  human_reviewed: boolean
  reviewed_at: string | null
  messages: ConversationMessage[]
}

export type CitationKind = 'law' | 'user_document'

export interface ItemCitation {
  kind: CitationKind
  node_id: string | null
  attachment_id: string | null
  page: number | null
  cited_text: string
}

export interface AnswerItem {
  text: string
  grounded: boolean
  citations?: ItemCitation[]
  checked: boolean
  edited_by_admin: boolean
}

export interface StructuredAnswer {
  summary: string
  checklist?: AnswerItem[] | null
  grounded: boolean
}

export interface Citation {
  kind: CitationKind
  node_id: string | null
  attachment_id: string | null
  page: number | null
  citation: string
  document_title: string
  jurisdiction: string | null
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

export type DocumentKind = 'review_request' | 'payment_plan_request' | 'extension_request' | 'nomination_statement' | 'hardship_application' | 'other'

export interface GeneratedDocumentSummary {
  id: string
  conversation_id: string
  message_position: number
  kind: DocumentKind
  title: string
  grounded: boolean
  byte_size: number
  supersedes_id: string | null
  created_at: string
}

export interface DocumentDetail extends GeneratedDocumentSummary { body_markdown: string; citations: Citation[] }
export interface DocumentDownload { url: string; url_expires_in_seconds: number; filename: string }

export interface TurnResponse {
  conversation_id: string
  status: 'needs_clarification' | 'answered' | 'drafted'
  clarification_intro?: string | null
  clarifying_questions?: ClarifyingQuestion[]
  answer?: StructuredAnswer | null
  citations?: Citation[]
  document?: GeneratedDocumentSummary | null
  disclaimer?: string | null
  message_position: number
}

export type GuidanceResponse = TurnResponse
export interface ChecklistItemState { position: number; index: number; checked: boolean }
export interface TranscriptionPayload { text: string }
export interface SpeechPayload { url: string; expires_in_seconds: number }
export interface FeedbackReceipt { id: string; rating: number; comment: string | null; conversation_id: string | null; created_at: string }

export interface BlogPostSummary {
  id: string
  slug: string
  title: string
  excerpt: string
  status: 'draft' | 'published'
  published_at: string | null
  author_name: string
  cover_image: { id: string; alt_text: string; url: string } | null
  created_at: string
  updated_at: string
}

export interface BlogPostDetail extends BlogPostSummary { content: Record<string, unknown> }
