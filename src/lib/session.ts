import type { AnonymousSession, TokenPair } from '../types/api'

const ACCESS_KEY = 'lawful_compass_access'
const REFRESH_KEY = 'lawful_compass_refresh'
const RESUME_KEY = 'lawful_compass_resume'

export const session = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  resume: () => localStorage.getItem(RESUME_KEY),
  setResume(resumeToken: string) {
    localStorage.setItem(RESUME_KEY, resumeToken)
  },
  setTokens(tokens: TokenPair) {
    localStorage.setItem(ACCESS_KEY, tokens.access_token)
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
  },
  setAnonymous(data: AnonymousSession) {
    this.setTokens(data)
    localStorage.setItem(RESUME_KEY, data.resume_token)
  },
  clearTokens() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
  clearAll() {
    this.clearTokens()
    localStorage.removeItem(RESUME_KEY)
  },
}
