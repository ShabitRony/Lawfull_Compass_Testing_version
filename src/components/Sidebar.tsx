import { Clock3, LogIn, LogOut, Menu, MessageSquareText, Plus, UserRound, X } from 'lucide-react'
import type { ConversationSummary, CurrentUser } from '../types/api'
import { Brand } from './Brand'

interface SidebarProps {
  conversations: ConversationSummary[]
  activeId: string | null
  loading: boolean
  open: boolean
  user: CurrentUser | null
  onClose: () => void
  onNew: () => void
  onSelect: (id: string) => void
  onAuth: () => void
  onSignOut: () => void
}

function relativeDate(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  if (diff < 86_400_000 && date.getDate() === new Date().getDate()) return 'Today'
  if (diff < 172_800_000) return 'Yesterday'
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(date)
}

export function Sidebar({ conversations, activeId, loading, open, user, onClose, onNew, onSelect, onAuth, onSignOut }: SidebarProps) {
  return (
    <>
      {open && <button className="sidebar-scrim" aria-label="Close conversation menu" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Brand />
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>

        <button className="new-question" onClick={onNew}>
          <Plus size={18} /> New question
        </button>

        <div className="history-label"><Clock3 size={14} /> Recent questions</div>
        <nav className="history" aria-label="Conversation history">
          {loading && Array.from({ length: 4 }, (_, index) => <div className="history-skeleton" key={index} />)}
          {!loading && conversations.length === 0 && (
            <div className="history-empty">
              <MessageSquareText size={21} />
              <span>Your questions will appear here.</span>
            </div>
          )}
          {!loading && conversations.map((conversation) => (
            <button
              className={`history-item ${activeId === conversation.id ? 'active' : ''}`}
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
            >
              <span className="history-title">{conversation.title || 'Untitled question'}</span>
              <span className="history-meta">{relativeDate(conversation.last_activity_at)} · {conversation.message_count} messages</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-account">
          <div className="account-avatar"><UserRound size={17} /></div>
          <div className="account-copy">
            <strong>{user?.kind === 'registered' ? user.username : 'Guest session'}</strong>
            <span>{user?.kind === 'registered' ? 'Saved account' : 'Questions saved on this device'}</span>
          </div>
          {user?.kind === 'registered' ? (
            <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={onSignOut}><LogOut size={17} /></button>
          ) : (
            <button className="icon-button" title="Sign in" aria-label="Sign in" onClick={onAuth}><LogIn size={17} /></button>
          )}
        </div>
      </aside>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return <button className="icon-button mobile-menu" onClick={onClick} aria-label="Open conversation menu"><Menu size={21} /></button>
}
