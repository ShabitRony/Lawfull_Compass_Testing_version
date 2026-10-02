import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CircleHelp, LoaderCircle, LogIn, Sparkles, UserRound } from 'lucide-react'
import { AuthDialog, type AuthMode, type AuthPayload } from './components/AuthDialog'
import { Brand } from './components/Brand'
import { CitationDrawer } from './components/CitationDrawer'
import { Composer, Conversation, Welcome, type ChatEntry } from './components/Conversation'
import { SecretDialog } from './components/SecretDialog'
import { MobileMenuButton, Sidebar } from './components/Sidebar'
import { MatterRail } from './components/MatterRail'
import { DocumentDrawer, FeedbackDialog } from './components/WorkspaceDialogs'
import { api, ApiError, errorMessage } from './lib/api'
import { session } from './lib/session'
import type { AttachmentUpload, Citation, ConversationDetail, ConversationMessage, ConversationSummary, CurrentUser, GeneratedDocumentSummary, GuidanceResponse } from './types/api'

function guidanceFromPayload(payload: Record<string, unknown> | null, conversationId: string, position: number): GuidanceResponse | undefined {
  if (!payload) return undefined
  const candidate = (payload.guidance && typeof payload.guidance === 'object' ? payload.guidance : payload) as Partial<GuidanceResponse>
  if (!candidate.status) return undefined
  return { ...candidate, conversation_id: candidate.conversation_id || conversationId, message_position: candidate.message_position ?? position } as GuidanceResponse
}

function entriesFromConversation(conversation: ConversationDetail): ChatEntry[] {
  return conversation.messages.map((message: ConversationMessage) => ({
    id: `${conversation.id}-${message.position}`,
    role: message.role === 'user' ? 'user' : 'assistant',
    text: message.text,
    position: message.position,
    inputMode: message.input_mode,
    attachments: message.attachments,
    guidance: guidanceFromPayload(message.payload, conversation.id, message.position),
  }))
}

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeTitle, setActiveTitle] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState(false)
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
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([])
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocumentSummary | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const requestId = useRef(0)
  const endRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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
      setReviewed(detail.human_reviewed)
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
    setReviewed(false)
    setQuestion('')
    setAttachments([])
    setInputMode('text')
    setNotice('')
    setSidebarOpen(false)
  }

  async function submitQuestion(prefilled?: string) {
    const text = (prefilled ?? question).trim()
    if (!text || submitting || text.length > 2000) return
    setSubmitting(true)
    setQuestion('')
    setNotice('')
    const sentAttachments = [...attachments]
    const sentInputMode = inputMode
    const userEntry: ChatEntry = { id: `user-${crypto.randomUUID()}`, role: 'user', text, attachments: sentAttachments, inputMode: sentInputMode }
    const pendingId = `pending-${crypto.randomUUID()}`
    setEntries((current) => [...current, userEntry, { id: pendingId, role: 'assistant', text: '', pending: true }])

    try {
      const guidance = await api.postTurn(text, activeId, sentInputMode, sentAttachments.map((file) => file.id))
      setActiveId(guidance.conversation_id)
      setEntries((current) => current.map((entry) => entry.id === pendingId
        ? { id: `assistant-${crypto.randomUUID()}`, role: 'assistant', text: guidance.answer?.summary || '', guidance, position: guidance.message_position }
        : entry))
      setAttachments([])
      setInputMode('text')
      setReviewed(false)
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
    try { if (session.refresh()) await api.logout() } catch { /* Local cleanup must always succeed. */ }
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

  async function uploadFiles(files: FileList) {
    const available = Math.max(0, 5 - attachments.length)
    const selected = Array.from(files).slice(0, available)
    if (!selected.length) return
    setUploading(true)
    setNotice('')
    try {
      const uploaded: AttachmentUpload[] = []
      for (const file of selected) uploaded.push(await api.uploadAttachment(file))
      setAttachments((current) => [...current, ...uploaded])
    } catch (error) { setNotice(errorMessage(error)) }
    finally { setUploading(false) }
  }

  async function removeAttachment(id: string) {
    try {
      await api.deleteAttachment(id)
      setAttachments((current) => current.filter((file) => file.id !== id))
    } catch (error) { setNotice(errorMessage(error)) }
  }

  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunksRef.current.push(event.data) }
      recorder.onstop = () => {
        setRecording(false)
        stream.getTracks().forEach((track) => track.stop())
        const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setSubmitting(true)
        api.transcribe(audio)
          .then((result) => { setQuestion(result.text); setInputMode('voice') })
          .catch((error) => setNotice(errorMessage(error)))
          .finally(() => setSubmitting(false))
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Microphone access is unavailable.') }
  }

  async function updateChecklist(position: number, index: number, checked: boolean) {
    const updateLocal = (value: boolean) => setEntries((current) => current.map((entry) => {
      if (entry.position !== position || !entry.guidance?.answer?.checklist) return entry
      return { ...entry, guidance: { ...entry.guidance, answer: { ...entry.guidance.answer, checklist: entry.guidance.answer.checklist.map((item, itemIndex) => itemIndex === index ? { ...item, checked: value } : item) } } }
    }))
    updateLocal(checked)
    try { await api.updateChecklistItem(activeId!, position, index, checked) }
    catch (error) { updateLocal(!checked); setNotice(errorMessage(error)) }
  }

  async function playSpeech(position: number) {
    if (!activeId) return
    try {
      const speech = await api.getMessageSpeech(activeId, position)
      const audio = new Audio(speech.url)
      await audio.play()
    } catch (error) { setNotice(errorMessage(error)) }
  }

  if (initializing) {
    return <main className="startup"><Brand /><LoaderCircle className="spin" size={26} /><p>Preparing your private legal workspace…</p></main>
  }

  const latestGuidance = [...entries].reverse().find((entry) => entry.guidance)?.guidance
  const railChecklist = latestGuidance?.answer?.checklist || []
  const railAttachments = entries.flatMap((entry) => entry.attachments || [])
  const railDocuments = entries.flatMap((entry) => entry.guidance?.document ? [entry.guidance.document] : [])
  const activeTag = conversations.find((conversation) => conversation.id === activeId)?.tag || null

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
        onFeedback={() => setFeedbackOpen(true)}
      />

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left"><MobileMenuButton onClick={() => setSidebarOpen(true)} /><div className="mobile-brand"><Brand /></div></div>
          <div className="matter-title"><strong>{activeTitle || 'New Matter'}</strong><small>{activeId ? 'Your saved legal matter' : 'Tell us what happened'}</small></div>
          <div className="topbar-actions">
            <button className="reading-button" title="Reading comfort">A<span>A</span></button>
            <button className="urgent-button"><CircleHelp size={14} /> Urgent Help</button>
            <button className="upgrade-button"><Sparkles size={15} /> Upgrade</button>
            <button className="account-button" onClick={() => user?.kind !== 'registered' && setAuthOpen(true)}>
              <UserRound size={16} />
              {user?.kind === 'registered' ? user.username : 'Sign in to save'}
              {user?.kind !== 'registered' && <LogIn size={15} />}
            </button>
          </div>
        </header>

        <div className={`content-scroll ${entries.length === 0 ? 'empty-content' : ''}`}>
          {notice && <div className="notice" role="alert"><AlertCircle size={17} /><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
          {conversationLoading ? (
            <div className="conversation-loading"><LoaderCircle className="spin" size={24} /> Loading conversation…</div>
          ) : entries.length === 0 ? (
            <Welcome onQuestion={(value) => void submitQuestion(value)} disabled={submitting} />
          ) : (
            <Conversation entries={entries} selectedTitle={activeTitle} reviewed={reviewed} onCitation={setSelectedCitation} onClarification={(value) => void submitQuestion(value)} onChecklist={(position, index, checked) => void updateChecklist(position, index, checked)} onSpeech={(position) => void playSpeech(position)} onDocument={setSelectedDocument} disabled={submitting} />
          )}
          <div ref={endRef} />
        </div>

        <Composer value={question} attachments={attachments} uploading={uploading} recording={recording} onChange={(value) => { setQuestion(value); if (inputMode === 'voice') setInputMode('text') }} onSubmit={() => void submitQuestion()} onFiles={(files) => void uploadFiles(files)} onRemoveAttachment={(id) => void removeAttachment(id)} onRecord={() => void toggleRecording()} disabled={submitting || conversationLoading} />
      </main>

      <MatterRail checklist={railChecklist} attachments={railAttachments} tag={activeTag} documents={railDocuments} onDocument={setSelectedDocument} />
      <footer className="legal-footer">Educational lawful guidance only, not legal advice.</footer>

      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onSubmit={authenticate} />
      <SecretDialog code={recoveryCode} onClose={() => setRecoveryCode(null)} />
      <CitationDrawer citation={selectedCitation} onClose={() => setSelectedCitation(null)} onNavigate={navigateCitation} />
      <DocumentDrawer document={selectedDocument} onClose={() => setSelectedDocument(null)} onDeleted={() => setSelectedDocument(null)} />
      <FeedbackDialog open={feedbackOpen} conversationId={activeId} onClose={() => setFeedbackOpen(false)} />
    </div>
  )
}
