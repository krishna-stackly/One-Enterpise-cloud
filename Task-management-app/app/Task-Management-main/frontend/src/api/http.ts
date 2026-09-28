import axios, { isAxiosError } from 'axios'
import { getAccessToken, readPersistedAccessToken } from '@/api/auth-token'
import { apiBaseUrl, useMock } from '@/api/client'

export const http = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = getAccessToken() ?? readPersistedAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Let the browser set multipart boundaries for FormData uploads.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

/** Normalizes backend ApiResponse errors into plain Error objects with the server message. */
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAxiosError(error)) {
      const payload = error.response?.data as { message?: string } | undefined
      return Promise.reject(new Error(payload?.message || error.message || 'Request failed'))
    }
    return Promise.reject(error instanceof Error ? error : new Error('Request failed'))
  },
)

export { useMock }
