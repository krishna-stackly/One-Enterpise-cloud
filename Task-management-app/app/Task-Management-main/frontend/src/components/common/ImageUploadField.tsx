import { ImagePlus, X } from 'lucide-react'
import { Label } from '@/components/ui/label'

export type ImageDraft = {
  fileName: string
  url: string
  contentType: string
  fileSize: number
  /** Present for newly chosen files that still need uploading to the API. */
  file?: File
}

export function filesToImageDrafts(list: FileList | File[]): Promise<ImageDraft[]> {
  const files = Array.from(list).filter((file) => file.type.startsWith('image/'))
  return Promise.all(
    files.map(
      (file) =>
        new Promise<ImageDraft>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () =>
            resolve({
              fileName: file.name,
              url: String(reader.result),
              contentType: file.type,
              fileSize: file.size,
              file,
            })
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        }),
    ),
  )
}

export function ImageUploadField({
  value,
  onChange,
  label = 'Reference images',
  hint = 'Upload screenshots or design images so the frontend team can implement against them.',
}: {
  value: ImageDraft[]
  onChange: (next: ImageDraft[]) => void
  label?: string
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
        onChange={(event) => {
          const selected = event.target.files
          if (!selected?.length) return
          void filesToImageDrafts(selected).then((drafts) => onChange([...value, ...drafts]))
          event.target.value = ''
        }}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
      {value.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {value.map((image, index) => (
            <div key={`${image.fileName}-${index}`} className="relative overflow-hidden rounded-lg border bg-slate-50">
              <img src={image.url} alt={image.fileName} className="h-24 w-full object-cover" />
              <button
                type="button"
                className="absolute top-1 right-1 rounded-full bg-slate-900/70 p-1 text-white"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={`Remove ${image.fileName}`}
              >
                <X className="h-3 w-3" />
              </button>
              <p className="truncate px-1 py-0.5 text-[10px] text-muted-foreground">{image.fileName}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground">
          <ImagePlus className="h-4 w-4" />
          No images yet. PNG, JPG, WebP, or GIF.
        </div>
      )}
    </div>
  )
}
