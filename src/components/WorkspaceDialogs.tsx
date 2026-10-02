import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Download, FileText, LoaderCircle, Star, Trash2, X } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import type { DocumentDetail, GeneratedDocumentSummary } from '../types/api'

export function DocumentDrawer({ document, onClose, onDeleted }: {
  document: GeneratedDocumentSummary | null
  onClose: () => void
  onDeleted: (id: string) => void
}) {
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!document) return
    let active = true
    setDetail(null)
    setLoading(true)
    setError('')
    api.getDocument(document.id)
      .then((result) => { if (active) setDetail(result) })
      .catch((caught) => { if (active) setError(errorMessage(caught)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [document])

  if (!document) return null

  async function download() {
    try {
      const result = await api.downloadDocument(document!.id)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (caught) { setError(errorMessage(caught)) }
  }

  async function remove() {
    if (!window.confirm('Delete this generated document?')) return
    try {
      await api.deleteDocument(document!.id)
      onDeleted(document!.id)
      onClose()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  return (
    <div className="citation-layer">
      <button className="citation-scrim" onClick={onClose} aria-label="Close document" />
      <aside className="citation-drawer document-drawer">
        <header className="citation-header">
          <div><span className="eyebrow">Generated document</span><h2>{document.title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {!document.grounded && <div className="grounding-warning"><AlertTriangle size={17} /> This draft is not fully grounded. Review it before use.</div>}
        {loading && <div className="drawer-loading"><LoaderCircle className="spin" size={24} /> Loading draft…</div>}
        {error && <div className="form-error">{error}</div>}
        {detail && <article className="document-body"><FileText size={20} /><div>{detail.body_markdown}</div></article>}
        <div className="document-actions">
          <button className="primary-button" onClick={() => void download()}><Download size={16} /> Download DOCX</button>
          <button className="danger-button" onClick={() => void remove()}><Trash2 size={15} /> Delete</button>
        </div>
      </aside>
    </div>
  )
}

export function FeedbackDialog({ open, conversationId, onClose }: { open: boolean; conversationId: string | null; onClose: () => void }) {
  const [rating, setRating] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!open) return
    setRating(0)
    setError('')
    setSent(false)
  }, [open])

  if (!open) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rating) { setError('Choose a rating first.'); return }
    const comment = String(new FormData(event.currentTarget).get('comment') || '').trim()
    setBusy(true)
    setError('')
    try {
      await api.submitFeedback(rating, comment || null, conversationId)
      setSent(true)
    } catch (caught) { setError(errorMessage(caught)) }
    finally { setBusy(false) }
  }

  return (
    <div className="dialog-layer">
      <button className="dialog-backdrop" onClick={onClose} aria-label="Close feedback" />
      <section className="auth-dialog feedback-dialog" role="dialog" aria-modal="true">
        <button className="dialog-close icon-button" onClick={onClose}><X size={20} /></button>
        {sent ? <><div className="auth-symbol"><Star size={24} /></div><h2>Thank you</h2><p className="auth-intro">Your feedback helps improve Lawful Compass.</p><button className="primary-button" onClick={onClose}>Close</button></> : (
          <form onSubmit={submit}>
            <p className="eyebrow">Share feedback</p><h2>How was this guidance?</h2>
            <div className="rating-picker">{[1,2,3,4,5].map((value) => <button type="button" className={value <= rating ? 'active' : ''} onClick={() => setRating(value)} key={value}><Star size={22} fill={value <= rating ? 'currentColor' : 'none'} /></button>)}</div>
            <label className="feedback-comment">Comment (optional)<textarea name="comment" maxLength={2000} rows={4} /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy && <LoaderCircle className="spin" size={16} />} Submit feedback</button>
          </form>
        )}
      </section>
    </div>
  )
}
