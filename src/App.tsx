import { useEffect, useRef, useState } from 'react'
import { AlertCircle, LoaderCircle, LogIn, UserRound } from 'lucide-react'
import { AuthDialog, type AuthMode, type AuthPayload } from './components/AuthDialog'
import { Brand } from './components/Brand'
import { CitationDrawer } from './components/CitationDrawer'
import { Composer, Conversation, Welcome, type ChatEntry } from './components/Conversation'
import { SecretDialog } from './components/SecretDialog'
import { MobileMenuButton, Sidebar } from './components/Sidebar'
import { api, ApiError, errorMessage } from './lib/api'
import { session } from './lib/session'
import type { Citation, ConversationDetail, ConversationMessage, ConversationSummary, CurrentUser, GuidanceResponse } from './types/api'

function guidanceFromPayload(payload: Record<string, unknown> | null): GuidanceResponse | undefined {
  if (!payload) return undefined
  const candidate = (payload.guidance && typeof payload.guidance === 'object' ? payload.guidance : payload) as Partial<GuidanceResponse>
  if (!candidate.conversation_id || !candidate.status || typeof candidate.refused !== 'boolean') return undefined
  return candidate as GuidanceResponse
}

function entriesFromConversation(conversation: ConversationDetail): ChatEntry[] {
  return conversation.messages.map((message: ConversationMessage) => ({
    id: `${conversation.id}-${message.position}`,
    role: message.role === 'user' ? 'user' : 'assistant',
    text: message.text,
    refused: message.refused,
    guidance: guidanceFromPayload(message.payload),
  }))
}

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeTitle, setActiveTitle] = useState<string | null>(null)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [question, setQuestion] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [conversationLoading, setConversationLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const requestId = useRef(0)
  const endRef = useRef<HTMLDivElement>(null)

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const result = await api.listConversations()
      setConversations(result.items)
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setHistoryLoading(false)
    }
  }

  async function establishAnonymous() {
    const anonymous = await api.createAnonymous()
    session.setAnonymous(anonymous)
    const current = await api.me()
    setUser(current)
  }

  async function initialize() {
    setInitializing(true)
    try {
      if (session.access()) {
        try {
          setUser(await api.me())
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error
          session.clearTokens()
          await establishAnonymous()
        }
      } else {
        await establishAnonymous()
      }
      await loadHistory()
    } catch {
      setUser(null)
      setConversations([])
    } finally {
      setInitializing(false)
    }
  }

  useEffect(() => { void initialize() }, [])

  useEffect(() => {
    if (entries.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries])

  async function selectConversation(id: string) {
    const currentRequest = ++requestId.current
    setSidebarOpen(false)
    setActiveId(id)
    setConversationLoading(true)
    setNotice('')
    try {
      const detail = await api.getConversation(id)
      if (currentRequest !== requestId.current) return
      setActiveTitle(detail.title)
      setEntries(entriesFromConversation(detail))
    } catch (error) {
      if (currentRequest === requestId.current) setNotice(errorMessage(error))
    } finally {
      if (currentRequest === requestId.current) setConversationLoading(false)
    }
  }

  function newQuestion() {
    requestId.current += 1
    setActiveId(null)
    setActiveTitle(null)
    setEntries([])
    setQuestion('')
    setNotice('')
    setSidebarOpen(false)
  }

  async function submitQuestion(prefilled?: string) {
    const text = (prefilled ?? question).trim()
    if (!text || submitting || text.length > 2000) return
    setSubmitting(true)
    setQuestion('')
    setNotice('')
    const userEntry: ChatEntry = { id: `user-${crypto.randomUUID()}`, role: 'user', text }
    const pendingId = `pending-${crypto.randomUUID()}`
    setEntries((current) => [...current, userEntry, { id: pendingId, role: 'assistant', text: '', pending: true }])

    try {
      const guidance = await api.postTurn(text, activeId)
      setActiveId(guidance.conversation_id)
      setEntries((current) => current.map((entry) => entry.id === pendingId
        ? { id: `assistant-${crypto.randomUUID()}`, role: 'assistant', text: guidance.answer?.summary || '', guidance, refused: guidance.refused }
        : entry))
      void loadHistory()
    } catch (error) {
      setEntries((current) => current.filter((entry) => entry.id !== pendingId && entry.id !== userEntry.id))
      setQuestion(text)
      setNotice(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function authenticate(mode: AuthMode, payload: AuthPayload) {
    let code: string | null = null
    if (mode === 'login') {
      session.setTokens(await api.login(payload.username!, payload.password!))
    } else if (mode === 'register') {
      const result = await api.register(payload.username!, payload.password!, payload.confirmPassword!)
      session.setTokens(result)
      code = result.recovery_code
    } else if (mode === 'recover') {
      const result = await api.recover(payload.recoveryCode!, payload.password!, payload.confirmPassword!)
      session.setTokens(result)
      code = result.recovery_code
    } else {
      session.setTokens(await api.resumeAnonymous(payload.resumeToken!))
      session.setResume(payload.resumeToken!)
    }

    const current = await api.me()
    setUser(current)
    setAuthOpen(false)
    setRecoveryCode(code)
    newQuestion()
    await loadHistory()
  }

  async function signOut() {
    session.clearAll()
    setUser(null)
    setConversations([])
    newQuestion()
    setInitializing(true)
    try {
      await establishAnonymous()
      await loadHistory()
    } catch (error) {
      setNotice(`${errorMessage(error)} The interface remains available, but answers and account features require the API service.`)
    } finally {
      setInitializing(false)
    }
  }

  function navigateCitation(nodeId: string) {
    if (!selectedCitation) return
    setSelectedCitation({ ...selectedCitation, node_id: nodeId })
  }

  if (initializing) {
    return <main className="startup"><Brand /><LoaderCircle className="spin" size={26} /><p>Preparing your private legal workspace…</p></main>
  }

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        loading={historyLoading}
        open={sidebarOpen}
        user={user}
        onClose={() => setSidebarOpen(false)}
        onNew={newQuestion}
        onSelect={(id) => void selectConversation(id)}
        onAuth={() => setAuthOpen(true)}
        onSignOut={() => void signOut()}
      />

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left"><MobileMenuButton onClick={() => setSidebarOpen(true)} /><div className="mobile-brand"><Brand /></div></div>
          <div className="service-state"><span /> Source-backed Australian law</div>
          <button className="account-button" onClick={() => user?.kind !== 'registered' && setAuthOpen(true)}>
            <UserRound size={16} />
            {user?.kind === 'registered' ? user.username : 'Sign in to save'}
            {user?.kind !== 'registered' && <LogIn size={15} />}
          </button>
        </header>

        <div className={`content-scroll ${entries.length === 0 ? 'empty-content' : ''}`}>
          {notice && <div className="notice" role="alert"><AlertCircle size={17} /><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
          {conversationLoading ? (
            <div className="conversation-loading"><LoaderCircle className="spin" size={24} /> Loading conversation…</div>
          ) : entries.length === 0 ? (
            <Welcome onQuestion={(value) => void submitQuestion(value)} disabled={submitting} />
          ) : (
            <Conversation entries={entries} selectedTitle={activeTitle} onCitation={setSelectedCitation} onClarification={(value) => void submitQuestion(value)} disabled={submitting} />
          )}
          <div ref={endRef} />
        </div>

        <Composer value={question} onChange={setQuestion} onSubmit={() => void submitQuestion()} disabled={submitting || conversationLoading} />
      </main>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onSubmit={authenticate} />
      <SecretDialog code={recoveryCode} onClose={() => setRecoveryCode(null)} />
      <CitationDrawer citation={selectedCitation} onClose={() => setSelectedCitation(null)} onNavigate={navigateCitation} />
    </div>
  )
}
