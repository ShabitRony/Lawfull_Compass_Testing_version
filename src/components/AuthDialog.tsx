import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, KeyRound, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { ApiError } from '../lib/api'

export type AuthMode = 'login' | 'register' | 'recover' | 'resume'

export interface AuthPayload {
  username?: string
  password?: string
  confirmPassword?: string
  recoveryCode?: string
  resumeToken?: string
}

interface AuthDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (mode: AuthMode, payload: AuthPayload) => Promise<void>
}

const modeCopy: Record<AuthMode, { title: string; intro: string }> = {
  login: { title: 'Welcome back', intro: 'Sign in to access your saved legal questions.' },
  register: { title: 'Save your questions', intro: 'Create an account without losing this guest conversation.' },
  recover: { title: 'Recover your account', intro: 'Use the recovery code issued when your account was created.' },
  resume: { title: 'Resume guest session', intro: 'Enter your private resume token to continue on this device.' },
}

export function AuthDialog({ open, onClose, onSubmit }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setMode('login')
      setError('')
      setFields({})
    }
  }, [open])

  if (!open) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload: AuthPayload = {
      username: String(form.get('username') || '').trim(),
      password: String(form.get('password') || ''),
      confirmPassword: String(form.get('confirmPassword') || ''),
      recoveryCode: String(form.get('recoveryCode') || '').trim(),
      resumeToken: String(form.get('resumeToken') || '').trim(),
    }
    if ((mode === 'register' || mode === 'recover') && payload.password !== payload.confirmPassword) {
      setFields({ confirm_password: 'Passwords do not match.' })
      return
    }
    setBusy(true)
    setError('')
    setFields({})
    try {
      await onSubmit(mode, payload)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFields(caught.fields || {})
      } else {
        setError('Unable to complete this request. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const inputError = (name: string) => fields[name] || fields[name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)]

  return (
    <div className="dialog-layer auth-layer" role="presentation">
      <button className="dialog-backdrop" onClick={onClose} aria-label="Close dialog" />
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="dialog-close icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="auth-symbol"><ShieldCheck size={27} /></div>
        <p className="eyebrow">Your private workspace</p>
        <h2 id="auth-title">{modeCopy[mode].title}</h2>
        <p className="auth-intro">{modeCopy[mode].intro}</p>

        <form onSubmit={submit} className="auth-form">
          {(mode === 'login' || mode === 'register') && (
            <label>Username
              <input name="username" autoComplete="username" required minLength={1} maxLength={255} aria-invalid={Boolean(inputError('username'))} />
              {inputError('username') && <span className="field-error">{inputError('username')}</span>}
            </label>
          )}
          {mode === 'recover' && (
            <label>Recovery code
              <input name="recoveryCode" autoComplete="off" required minLength={1} maxLength={40} aria-invalid={Boolean(inputError('recovery_code'))} />
              {inputError('recovery_code') && <span className="field-error">{inputError('recovery_code')}</span>}
            </label>
          )}
          {mode === 'resume' && (
            <label>Resume token
              <input name="resumeToken" autoComplete="off" required pattern="[A-Za-z0-9_-]+" aria-invalid={Boolean(inputError('resume_token'))} />
              {inputError('resume_token') && <span className="field-error">{inputError('resume_token')}</span>}
            </label>
          )}
          {mode !== 'resume' && (
            <label>{mode === 'login' ? 'Password' : 'New password'}
              <input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required maxLength={128} aria-invalid={Boolean(inputError('password'))} />
              {inputError('password') && <span className="field-error">{inputError('password')}</span>}
            </label>
          )}
          {(mode === 'register' || mode === 'recover') && (
            <label>Confirm password
              <input name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={Boolean(inputError('confirm_password'))} />
              {inputError('confirm_password') && <span className="field-error">{inputError('confirm_password')}</span>}
            </label>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={17} />}
            {mode === 'login' && 'Sign in'}
            {mode === 'register' && 'Create account'}
            {mode === 'recover' && 'Recover account'}
            {mode === 'resume' && 'Resume session'}
          </button>
        </form>

        {mode === 'login' ? (
          <div className="auth-options">
            <button onClick={() => setMode('register')}>Create an account</button>
            <button onClick={() => setMode('recover')}>Use recovery code</button>
            <button onClick={() => setMode('resume')}><KeyRound size={14} /> Resume guest session</button>
          </div>
        ) : (
          <button className="back-link" onClick={() => { setMode('login'); setError(''); setFields({}) }}><ArrowLeft size={15} /> Back to sign in</button>
        )}
      </section>
    </div>
  )
}
