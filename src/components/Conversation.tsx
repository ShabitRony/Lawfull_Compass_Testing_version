import { useRef } from 'react'
import {
  AlertTriangle, ArrowUp, BookOpenText, Check, FileCheck2, FileText, Headphones,
  Info, LoaderCircle, Mic, Paperclip, Scale, ShieldAlert, Square, Trash2, Upload,
} from 'lucide-react'
import type { AttachmentUpload, Citation, GeneratedDocumentSummary, GuidanceResponse } from '../types/api'

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  guidance?: GuidanceResponse
  pending?: boolean
  position?: number
  attachments?: AttachmentUpload[]
  inputMode?: string | null
}

interface ConversationProps {
  entries: ChatEntry[]
  selectedTitle?: string | null
  reviewed?: boolean
  onCitation: (citation: Citation) => void
  onClarification: (answer: string) => void
  onChecklist: (position: number, index: number, checked: boolean) => void
  onSpeech: (position: number) => void
  onDocument: (document: GeneratedDocumentSummary) => void
  disabled: boolean
}

const starterQuestions = [
  'What can I do about a traffic camera fine?',
  'Can I request more time to pay an infringement?',
  'How do I nominate another driver for a fine?',
]

export function Welcome({ onQuestion, disabled }: { onQuestion: (question: string) => void; disabled: boolean }) {
  return (
    <section className="welcome">
      <div className="welcome-emblem"><Scale size={31} strokeWidth={1.5} /></div>
      <p className="eyebrow">Australian law, made clearer</p>
      <h1>Find your bearings<br />in the law.</h1>
      <p className="welcome-copy">Ask a question in plain English. Add a notice or document when its details matter, and receive source-backed guidance.</p>
      <div className="starter-grid">
        {starterQuestions.map((question, index) => (
          <button key={question} disabled={disabled} onClick={() => onQuestion(question)}>
            <span>0{index + 1}</span>{question}<ArrowUp size={16} />
          </button>
        ))}
      </div>
      <div className="trust-line"><ShieldAlert size={15} /> General legal information, not legal advice. For urgent matters, speak to a qualified lawyer.</div>
    </section>
  )
}

function Sources({ citations, onCitation }: { citations: Citation[]; onCitation: (citation: Citation) => void }) {
  if (!citations.length) return null
  return (
    <div className="sources">
      <div className="answer-section-title"><BookOpenText size={16} /> Sources</div>
      <div className="source-list">
        {citations.map((citation, index) => (
          <button
            className={`source-card ${citation.kind === 'user_document' ? 'user-source' : ''}`}
            key={citation.node_id || `${citation.attachment_id}-${citation.page}-${index}`}
            onClick={() => onCitation(citation)}
          >
            <span className="source-number">{index + 1}</span>
            <span>
              <strong>{citation.citation}</strong>
              <small>{citation.kind === 'user_document' ? `Your document${citation.page ? ` · page ${citation.page}` : ''}` : `${citation.document_title} · ${citation.jurisdiction || 'Australia'}`}</small>
              <span className="source-card-snippet">{citation.snippet}</span>
            </span>
            <ArrowUp size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}

function Guidance({ value, position, onCitation, onClarification, onChecklist, onSpeech, onDocument, disabled }: {
  value: GuidanceResponse
  position?: number
  onCitation: (citation: Citation) => void
  onClarification: (answer: string) => void
  onChecklist: (position: number, index: number, checked: boolean) => void
  onSpeech: (position: number) => void
  onDocument: (document: GeneratedDocumentSummary) => void
  disabled: boolean
}) {
  const answer = value.answer
  const citations = value.citations || []
  const messagePosition = position ?? value.message_position

  if (value.status === 'needs_clarification') {
    return (
      <div className="clarification-block">
        <div className="answer-section-title"><Info size={16} /> A little more detail</div>
        {value.clarification_intro && <p className="clarification-intro">{value.clarification_intro}</p>}
        {(value.clarifying_questions || []).map((question) => (
          <div className="clarification" key={question.id}>
            <p>{question.question}</p>
            <small>{question.why}</small>
            {question.options.length > 0 && (
              <div className="choice-list">
                {question.options.map((option) => <button disabled={disabled} onClick={() => onClarification(option)} key={option}>{option}</button>)}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {answer && !answer.grounded && (
        <div className="grounding-warning"><AlertTriangle size={17} /><span>This answer is not fully grounded in an authoritative source. Verify it before relying on it.</span></div>
      )}
      {answer?.summary && <div className="answer-summary">{answer.summary}</div>}
      {!!answer?.checklist?.length && (
        <section className="answer-section">
          <div className="answer-section-title"><FileCheck2 size={16} /> Practical steps</div>
          <ol className="answer-list interactive-checklist">
            {answer.checklist.map((item, index) => (
              <li className={item.checked ? 'checked' : ''} key={`${item.text}-${index}`}>
                <button
                  aria-label={item.checked ? 'Mark incomplete' : 'Mark complete'}
                  disabled={disabled}
                  onClick={() => onChecklist(messagePosition, index, !item.checked)}
                ><Check size={14} /></button>
                <p>{item.text}{item.edited_by_admin && <small>Reviewed by staff</small>}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {value.document && (
        <button className={`document-card ${value.document.grounded ? '' : 'ungrounded'}`} onClick={() => onDocument(value.document)}>
          <FileText size={22} />
          <span><small>Drafted document</small><strong>{value.document.title}</strong></span>
          <ArrowUp size={17} />
        </button>
      )}
      <Sources citations={citations} onCitation={onCitation} />
      <div className="answer-footer">
        {value.disclaimer && <div className="answer-disclaimer"><Info size={15} />{value.disclaimer}</div>}
        <button className="speech-button" onClick={() => onSpeech(messagePosition)}><Headphones size={15} /> Listen</button>
      </div>
    </>
  )
}

export function Conversation({ entries, selectedTitle, reviewed, onCitation, onClarification, onChecklist, onSpeech, onDocument, disabled }: ConversationProps) {
  return (
    <section className="conversation" aria-live="polite">
      {selectedTitle && (
        <div className="conversation-heading">
          <span>Legal research {reviewed ? '· Staff reviewed' : ''}</span><h1>{selectedTitle}</h1>
        </div>
      )}
      {entries.map((entry) => entry.role === 'user' ? (
        <div className="user-row" key={entry.id}>
          <div>
            {!!entry.attachments?.length && <div className="message-attachments">{entry.attachments.map((file) => <span key={file.id}><Paperclip size={12} />{file.filename}</span>)}</div>}
            <div className="user-message">{entry.inputMode === 'voice' && <Mic size={13} />}{entry.text}</div>
          </div>
        </div>
      ) : (
        <div className="assistant-row" key={entry.id}>
          <div className="assistant-mark"><Scale size={17} /></div>
          <div className="assistant-content">
            {entry.pending ? (
              <div className="thinking"><LoaderCircle className="spin" size={17} /><span>Reviewing relevant Australian law…</span></div>
            ) : entry.guidance ? (
              <Guidance value={entry.guidance} position={entry.position} onCitation={onCitation} onClarification={onClarification} onChecklist={onChecklist} onSpeech={onSpeech} onDocument={onDocument} disabled={disabled} />
            ) : (
              <div className="plain-answer">{entry.text}</div>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

export function Composer({ value, attachments, uploading, recording, onChange, onSubmit, onFiles, onRemoveAttachment, onRecord, disabled }: {
  value: string
  attachments: AttachmentUpload[]
  uploading: boolean
  recording: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onFiles: (files: FileList) => void
  onRemoveAttachment: (id: string) => void
  onRecord: () => void
  disabled: boolean
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  return (
    <div className="composer-wrap">
      <div className="composer">
        {!!attachments.length && (
          <div className="composer-files">
            {attachments.map((file) => (
              <span key={file.id}><FileText size={14} /><span>{file.filename}<small>{file.page_count} page{file.page_count === 1 ? '' : 's'}</small></span><button onClick={() => onRemoveAttachment(file.id)} aria-label={`Remove ${file.filename}`}><Trash2 size={13} /></button></span>
            ))}
          </div>
        )}
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSubmit() } }}
          placeholder="Ask about Australian law or legislation…"
          maxLength={2000}
          rows={1}
          disabled={disabled}
          aria-label="Your legal question"
        />
        <div className="composer-actions">
          <div className="composer-tools">
            <input ref={fileInput} hidden type="file" multiple accept=".pdf,.doc,.docx,image/*" onChange={(event) => event.target.files && onFiles(event.target.files)} />
            <button className="tool-button" onClick={() => fileInput.current?.click()} disabled={disabled || uploading || attachments.length >= 5} aria-label="Attach files">
              {uploading ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}
            </button>
            <button className={`tool-button ${recording ? 'recording' : ''}`} onClick={onRecord} disabled={disabled} aria-label={recording ? 'Stop recording' : 'Record question'}>
              {recording ? <Square size={15} /> : <Mic size={17} />}
            </button>
            <span>{value.length > 1700 ? `${value.length}/2000` : 'Add your state or territory where relevant'}</span>
          </div>
          <button className="send-button" onClick={onSubmit} disabled={disabled || !value.trim()} aria-label="Send question"><ArrowUp size={19} /></button>
        </div>
      </div>
      <p>Lawful Compass can make mistakes. Check cited legislation or seek professional legal advice.</p>
    </div>
  )
}
