// Platform branching only — no repo/store import, no CSV-format knowledge.
// Mobile is the target platform (AGENTS.md): on iOS a plain `<a download>`
// typically opens a tab instead of saving, so `navigator.share({ files })`
// is tried first wherever the platform can share a `File` — it is also the
// native-feeling path — with a download link as the fallback everywhere
// else (specs.md §10.12).

const CSV_MIME_TYPE = 'text/csv;charset=utf-8'

// Revoking in the same task as `anchor.click()` races the browser's blob
// read — iOS Safari in particular doesn't guarantee the download has started
// reading the blob before this task ends, and an early revoke can cancel it.
// Deferring past the current task (the same fix FileSaver.js applies to this
// exact hazard) lets the browser open the blob URL before it's invalidated.
const REVOKE_DELAY_MS = 1000

export interface CsvDelivery {
  filename: string
  /** String parts, handed straight to `new Blob(parts)` — never joined into one string first. */
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

/**
 * Hands the CSV to the user. Tries `navigator.share({ files })` first when
 * the platform supports sharing this exact file; the user dismissing the
 * share sheet (`AbortError`) is not a failure and resolves quietly. Falls
 * back to a download link everywhere else, or if sharing itself rejects for
 * a reason other than user cancellation.
 */
export const deliverCsv = async ({ filename, parts }: CsvDelivery): Promise<void> => {
  const blob = new Blob([...parts], { type: CSV_MIME_TYPE })
  const file = new File([blob], filename, { type: CSV_MIME_TYPE })

  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (error) {
      if (isAbortError(error)) return
      // Best-effort fallback path, not a hard failure — the file is still
      // delivered via download, so this is worth a trace but not a throw.
      console.warn('export: navigator.share failed, falling back to a download link', error)
    }
  }

  triggerDownload(blob, filename)
}
