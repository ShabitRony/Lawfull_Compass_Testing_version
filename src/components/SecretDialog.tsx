import { Check, Copy, KeyRound, X } from 'lucide-react'
import { useState } from 'react'

export function SecretDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null

  async function copy() {
    await navigator.clipboard.writeText(code!)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="dialog-layer">
      <div className="dialog-backdrop" />
      <section className="secret-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <button className="dialog-close icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="auth-symbol"><KeyRound size={25} /></div>
        <p className="eyebrow">Shown once</p>
        <h2 id="recovery-title">Save your recovery code</h2>
        <p>This is the only way to recover your account if you forget your password. Store it somewhere secure.</p>
        <button className="recovery-code" onClick={copy}><code>{code}</code>{copied ? <Check size={18} /> : <Copy size={18} />}</button>
        <button className="primary-button" onClick={onClose}>I’ve saved this code</button>
      </section>
    </div>
  )
}
