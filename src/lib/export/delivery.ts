// On iOS, a plain <a download> typically opens the file in a tab instead of saving it,
// so navigator.share({ files }) is tried first wherever the platform can share a File.

const CSV_MIME_TYPE = 'text/csv;charset=utf-8'

// Revoking the object URL in the same task as anchor.click() races the browser's blob
// read — iOS Safari in particular doesn't guarantee the download has started reading
// the blob before this task ends, and an early revoke can cancel it.
const REVOKE_DELAY_MS = 1000

export interface CsvDelivery {
  filename: string
  parts: readonly string[]
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

const canShareFile = (file: File): boolean =>
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [file] })

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
  }
}

export const deliverCsv = async ({ filename, parts }: CsvDelivery): Promise<void> => {
  const blob = new Blob([...parts], { type: CSV_MIME_TYPE })
  const file = new File([blob], filename, { type: CSV_MIME_TYPE })

  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (error) {
      if (isAbortError(error)) return
      console.warn('export: navigator.share failed, falling back to a download link', error)
    }
  }

  triggerDownload(blob, filename)
}
