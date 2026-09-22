/** In-memory access token so API calls work before zustand persist flushes to localStorage. */
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export function readPersistedAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem('stackly-auth')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string | null } }
    return parsed.state?.accessToken ?? null
  } catch {
    return null
  }
}
