import { useEffect, useState } from 'react'
import { http } from '@/api/http'
import { cn } from '@/lib/utils'

/** Loads an authenticated API image URL as a blob so <img> works with JWT. */
export function AuthImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setFailed(false)
    setBlobUrl(null)

    const path = src.startsWith('/api') ? src.replace(/^\/api/, '') || '/' : src
    void http
      .get(path, { responseType: 'blob' })
      .then((response) => {
        if (!active) return
        objectUrl = URL.createObjectURL(response.data)
        setBlobUrl(objectUrl)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (failed) {
    return <div className={cn('flex items-center justify-center bg-slate-100 text-xs text-muted-foreground', className)}>Unavailable</div>
  }
  if (!blobUrl) {
    return <div className={cn('animate-pulse bg-slate-100', className)} aria-hidden />
  }
  return <img src={blobUrl} alt={alt} className={className} />
}
