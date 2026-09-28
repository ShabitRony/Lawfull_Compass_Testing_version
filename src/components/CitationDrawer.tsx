import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, FileText, LoaderCircle, X } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import type { Citation, CitationDetail } from '../types/api'

interface CitationDrawerProps {
  citation: Citation | null
  onClose: () => void
  onNavigate: (nodeId: string) => void
}

export function CitationDrawer({ citation, onClose, onNavigate }: CitationDrawerProps) {
  const [detail, setDetail] = useState<CitationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!citation) return
    let active = true
    setDetail(null)
    setError('')
    setLoading(true)
    api.getCitation(citation.node_id)
      .then((result) => { if (active) setDetail(result) })
      .catch((caught) => { if (active) setError(errorMessage(caught)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [citation])

  if (!citation) return null

  return (
    <div className="citation-layer">
      <button className="citation-scrim" onClick={onClose} aria-label="Close source" />
      <aside className="citation-drawer" aria-label="Legislation source">
        <header className="citation-header">
          <div><span className="eyebrow">Primary source</span><h2>Source detail</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {loading && <div className="drawer-loading"><LoaderCircle className="spin" size={24} /> Retrieving source text…</div>}
        {error && (
          <div className="drawer-error">
            <FileText size={24} />
            <strong>Source detail unavailable</strong>
            <p>{error}</p>
            <p className="source-snippet">{citation.snippet}</p>
          </div>
        )}
        {detail && (
          <div className="citation-content">
            <span className="jurisdiction-pill">{detail.jurisdiction}</span>
            <h3>{detail.document_title}</h3>
            <p className="citation-name">{detail.citation}</p>
            {(detail.heading_path || detail.heading) && <p className="heading-path">{detail.heading_path || detail.heading}</p>}
            <dl className="source-facts">
              <div><dt>Identifier</dt><dd>{detail.official_identifier}</dd></div>
              {detail.document_type && <div><dt>Type</dt><dd>{detail.document_type}</dd></div>}
              {detail.effective_from && <div><dt>Effective from</dt><dd>{new Date(detail.effective_from).toLocaleDateString('en-AU')}</dd></div>}
            </dl>
            <div className="source-text">{detail.text}</div>
            {detail.source_url && <a className="official-link" href={detail.source_url} target="_blank" rel="noreferrer">View official source <ExternalLink size={15} /></a>}
            <div className="source-navigation">
              <button disabled={!detail.previous_node_id} onClick={() => detail.previous_node_id && onNavigate(detail.previous_node_id)}><ArrowLeft size={16} /> Previous provision</button>
              <button disabled={!detail.next_node_id} onClick={() => detail.next_node_id && onNavigate(detail.next_node_id)}>Next provision <ArrowRight size={16} /></button>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
