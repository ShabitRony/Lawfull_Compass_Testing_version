import { Check, Download, Eye, FileText } from 'lucide-react'
import type { AttachmentSummary, ConversationTag, GeneratedDocumentSummary } from '../types/api'

interface MatterRailProps {
  checklist: { text: string; checked: boolean }[]
  attachments: AttachmentSummary[]
  tag: ConversationTag | null
  documents: GeneratedDocumentSummary[]
  onDocument: (document: GeneratedDocumentSummary) => void
}

const tagLabels: Record<ConversationTag, string> = {
  'traffic-camera-infringements': 'Traffic camera infringement',
  'council-infringements': 'Council infringement',
  'parking-fines': 'Parking fine',
  'debt-fine-enforcement': 'Debt and fine enforcement',
  other: 'Other legal matter',
}

export function MatterRail({ checklist, attachments, tag, documents, onDocument }: MatterRailProps) {
  return (
    <aside className="matter-rail" aria-label="Matter details">
      <section>
        <h2>{checklist.length ? 'Your Checklist' : 'How this works'}</h2>
        {checklist.length ? checklist.slice(0, 5).map((item, index) => (
          <div className="rail-check" key={`${item.text}-${index}`}>
            <span className={item.checked ? 'checked' : ''}>{item.checked && <Check size={13} />}</span>
            <p>{item.text}</p>
          </div>
        )) : (
          <ol className="how-list">
            <li><span>1</span><div><strong>Tell us what happened</strong><small>In your own words, or pick an option</small></div></li>
            <li><span>2</span><div><strong>We ask a few questions</strong><small>To find the rules for your state</small></div></li>
            <li><span>3</span><div><strong>You get clear next steps</strong><small>Tick them off as you go</small></div></li>
          </ol>
        )}
      </section>

      <section>
        <h2>Your uploaded files</h2>
        {attachments.length ? attachments.map((file) => (
          <div className="rail-file" key={file.id}><FileText size={16} /><span>{file.filename}</span><small>{file.page_count}p</small></div>
        )) : <p className="rail-empty">Your uploaded files will be visible here, and we will use them when preparing guidance.</p>}
      </section>

      <section>
        <h2>Category</h2>
        {tag ? <><span className="category-pill">{tagLabels[tag]}</span><p className="rail-empty">Identified from the details in your matter.</p></> : <p className="rail-empty">Identified from your answers about the notice type, state, and amount owed.</p>}
      </section>

      <section>
        <h2>{documents.length ? 'Saved documents' : 'Generate Document'}</h2>
        {documents.length ? documents.map((document) => (
          <button className="rail-document" key={document.id} onClick={() => onDocument(document)}>
            <FileText size={18} /><span><strong>{document.title}</strong><small>{document.grounded ? 'Source-backed' : 'Check before using'}</small></span><Download size={15} /><Eye size={15} />
          </button>
        )) : <p className="rail-empty">Documents prepared from your answers will appear here.</p>}
      </section>
    </aside>
  )
}
