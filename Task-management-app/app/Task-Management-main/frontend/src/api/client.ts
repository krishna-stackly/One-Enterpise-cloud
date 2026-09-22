export async function wait<T>(data: T, ms = 420): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms))
  return structuredClone(data)
}

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
export const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
