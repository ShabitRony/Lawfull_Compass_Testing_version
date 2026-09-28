import { AlertTriangle, ArrowUp, BookOpenText, Check, FileCheck2, Info, LoaderCircle, Scale, ShieldAlert, Sparkles } from 'lucide-react'
import type { Citation, GuidanceResponse } from '../types/api'

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  guidance?: GuidanceResponse
  pending?: boolean
  refused?: boolean
}

interface ConversationProps {
  entries: ChatEntry[]
  selectedTitle?: string | null
  onCitation: (citation: Citation) => void
  onClarification: (answer: string) => void
  disabled: boolean
}

const starterQuestions = [
  'What are my rights if my landlord wants to end my lease?',
  'How does unfair dismissal work in Australia?',
  'What should I do after receiving a court notice?',
]

export function Welcome({ onQuestion, disabled }: { onQuestion: (question: string) => void; disabled: boolean }) {
  return (
    <section className="welcome">
      <div className="welcome-emblem"><Scale size={31} strokeWidth={1.5} /></div>
      <p className="eyebrow">Australian law, made clearer</p>
      <h1>Find your bearings<br />in the law.</h1>
      <p className="welcome-copy">Ask a question in plain English. Lawful Compass finds relevant Australian legislation and explains the practical next steps, with sources.</p>
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
          <button className="source-card" key={citation.node_id} onClick={() => onCitation(citation)}>
            <span className="source-number">{index + 1}</span>
            <span><strong>{citation.citation}</strong><small>{citation.document_title} · {citation.jurisdiction}</small></span>
            <ArrowUp size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}

function Guidance({ value, onCitation, onClarification, disabled }: {
  value: GuidanceResponse
  onCitation: (citation: Citation) => void
  onClarification: (answer: string) => void
  disabled: boolean
}) {
  const answer = value.answer
  const citations = value.citations || []

  if (value.status === 'needs_clarification') {
    return (
      <div className="clarification-block">
        <div className="answer-section-title"><Info size={16} /> A little more detail</div>
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

  if (value.refused || value.status === 'refused') {
    return (
      <div className="refusal">
        <AlertTriangle size={19} />
        <div><strong>I can’t give a reliable answer from the available law.</strong><p>{value.refusal_reason?.replaceAll('_', ' ') || 'No authoritative source was found.'} Try adding the relevant state or territory and more context.</p></div>
      </div>
    )
  }

  return (
    <>
      {answer?.summary && <div className="answer-summary">{answer.summary}</div>}
      {!!answer?.checklist?.length && (
        <section className="answer-section">
          <div className="answer-section-title"><FileCheck2 size={16} /> Practical steps</div>
          <ol className="answer-list">
            {answer.checklist.map((item, index) => <li key={index}><span><Check size={14} /></span><p>{item.text}</p></li>)}
          </ol>
        </section>
      )}
      {!!answer?.evidence_needed?.length && (
        <section className="answer-section evidence">
          <div className="answer-section-title"><Sparkles size={16} /> Information to gather</div>
          <ul className="evidence-list">
            {answer.evidence_needed.map((item, index) => <li key={index}>{item.text}</li>)}
          </ul>
        </section>
      )}
      {answer && answer.withheld_count > 0 && <p className="withheld-note">{answer.withheld_count} unsupported point{answer.withheld_count === 1 ? ' was' : 's were'} omitted from this answer.</p>}
      <Sources citations={citations} onCitation={onCitation} />
      {value.disclaimer && <div className="answer-disclaimer"><Info size={15} />{value.disclaimer}</div>}
    </>
  )
}

export function Conversation({ entries, selectedTitle, onCitation, onClarification, disabled }: ConversationProps) {
  return (
    <section className="conversation" aria-live="polite">
      {selectedTitle && <div className="conversation-heading"><span>Legal research</span><h1>{selectedTitle}</h1></div>}
      {entries.map((entry) => entry.role === 'user' ? (
        <div className="user-row" key={entry.id}><div className="user-message">{entry.text}</div></div>
      ) : (
        <div className="assistant-row" key={entry.id}>
          <div className="assistant-mark"><Scale size={17} /></div>
          <div className="assistant-content">
            {entry.pending ? (
              <div className="thinking"><LoaderCircle className="spin" size={17} /><span>Reviewing relevant Australian law…</span></div>
            ) : entry.guidance ? (
              <Guidance value={entry.guidance} onCitation={onCitation} onClarification={onClarification} disabled={disabled} />
            ) : (
              <div className={entry.refused ? 'plain-answer refused-text' : 'plain-answer'}>{entry.text}</div>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

export function Composer({ value, onChange, onSubmit, disabled }: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
}) {
  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSubmit()
            }
          }}
          placeholder="Ask about Australian law or legislation…"
          maxLength={2000}
          rows={1}
          disabled={disabled}
          aria-label="Your legal question"
        />
        <div className="composer-actions">
          <span>{value.length > 1700 ? `${value.length}/2000` : 'Include your state or territory where relevant'}</span>
          <button onClick={onSubmit} disabled={disabled || !value.trim()} aria-label="Send question"><ArrowUp size={19} /></button>
        </div>
      </div>
      <p>Lawful Compass can make mistakes. Check cited legislation or seek professional legal advice.</p>
    </div>
  )
}
