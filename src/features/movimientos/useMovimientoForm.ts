import { useMemo, useState } from 'react'
import type { Categoria, Moneda, Movimiento, TipoMovimiento } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import {
  formatAmountForInput,
  parseAmountForInput,
  type ParsedAmount,
} from '@/lib/i18n/amountFormat'

export type MovimientoFormMode = 'create' | 'edit'

export type AmountErrorReason = Exclude<ParsedAmount, { ok: true }>['reason']

/**
 * The seam stage 3 (voice) wires a parser into (specs.md §10.23 Decision
 * 5) — a single entry point that sets already-typed field values, so a
 * future voice-command parser adds a button and a parser without
 * restructuring this hook. `categoriaId` must already be a real category
 * id (matching a spoken name against the taxonomy is the parser's job,
 * not this hook's); `seccionId` is derived from it via `categorias`, the
 * same as `selectCategoria`.
 */
export interface MovimientoFormPatch {
  tipo?: TipoMovimiento
  monto?: number
  fecha?: string
  nota?: string
  categoriaId?: string
}

export interface UseMovimientoFormArgs {
  mode: MovimientoFormMode
  /** The movement being edited — required (and read) only when `mode === 'edit'`. */
  initial?: Movimiento
  /** BCP-47, from `useLocaleFormatting()` — no default, same convention as `MovimientoRow`. */
  locale: string
  monedaPrincipal: Moneda
  /** Every category (archived or not) — resolves `applyParsedFields`'s `categoriaId` to a `seccionId`. */
  categorias: Categoria[]
  /** Called once the write has actually committed (specs.md §10.23 Decision 3) — never on a refused or failed write, so the caller only closes/returns to view when there is really nothing left to lose. */
  onSaved: () => void
}

export interface UseMovimientoFormResult {
  tipo: TipoMovimiento
  setTipo: (tipo: TipoMovimiento) => void
  amountRaw: string
  setAmountRaw: (raw: string) => void
  /** `undefined` until a submit has actually been attempted — a blank field showing an error on first render is not the UX a validation exists for. */
  amountErrorReason?: AmountErrorReason
  fecha: string
  setFecha: (iso: string) => void
  /** The id that will be written — kept even when it doesn't resolve against `categorias` (specs.md §10.22: edit never silently reassigns it). */
  categoriaId?: string
  /** `CategoryPicker`'s `onSelect` hands back the full `Categoria` — this sets both `categoriaId` and the `seccionId` derived from it in one call, per specs.md §10.22 ("seccion is not picked, it is derived"). */
  selectCategoria: (categoria: Categoria) => void
  categoriaMissing: boolean
  nota: string
  setNota: (value: string) => void
  submitting: boolean
  submit: () => Promise<void>
  /** Increments on every `submit()` call, blocked or not — unlike `amountErrorReason`/`categoriaMissing`, this changes even when the same invalid state is hit twice in a row, so a view can key an effect off it to react to a fresh tap rather than the (unchanged) derived error flags. */
  submitAttempts: number
  /** Discards whatever is typed and returns to `mode`'s defaults — used when a create sheet is dismissed without saving. */
  reset: () => void
  applyParsedFields: (patch: MovimientoFormPatch) => void
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

interface FormFields {
  tipo: TipoMovimiento
  amountRaw: string
  fecha: string
  nota: string
  categoriaId?: string
  seccionId?: string
}

const defaultsFor = (
  mode: MovimientoFormMode,
  initial: Movimiento | undefined,
  locale: string,
): FormFields => {
  if (mode === 'edit' && initial) {
    return {
      tipo: initial.tipo,
      amountRaw: formatAmountForInput(initial.monto, locale),
      fecha: initial.fecha,
      nota: initial.nota ?? '',
      categoriaId: initial.categoria,
      seccionId: initial.seccion,
    }
  }
  return {
    tipo: 'gasto',
    amountRaw: '',
    fecha: todayIso(),
    nota: '',
    categoriaId: undefined,
    seccionId: undefined,
  }
}

/**
 * Field state, validation and submit — the only place either
 * `AddMovimientoSheet` or `MovimientoSheet`'s edit mode writes a movement
 * (specs.md §10.23 Decision 1). Money-adjacent (validates and writes
 * `Movimiento.monto`/`categoria`/`seccion`), so covered start-to-finish by
 * TDD per `AGENTS.md`.
 */
export const useMovimientoForm = ({
  mode,
  initial,
  locale,
  monedaPrincipal,
  categorias,
  onSaved,
}: UseMovimientoFormArgs): UseMovimientoFormResult => {
  const createMovimiento = useDataStore((s) => s.createMovimiento)
  const updateMovimiento = useDataStore((s) => s.updateMovimiento)

  const [fields, setFields] = useState<FormFields>(() => defaultsFor(mode, initial, locale))
  const [submitting, setSubmitting] = useState(false)
  // Only set once the user actually tries to save — an empty amount field
  // showing "ingresá un monto" before a single keystroke is nagging, not
  // validation (matches CategoryFormModal's own disabled-until-valid Save,
  // just surfaced as an inline message instead since this form has more
  // than one required field).
  const [attempted, setAttempted] = useState(false)
  const [submitAttempts, setSubmitAttempts] = useState(0)

  const parsedAmount = useMemo(
    () => parseAmountForInput(fields.amountRaw, locale),
    [fields.amountRaw, locale],
  )
  const amountErrorReason = attempted && !parsedAmount.ok ? parsedAmount.reason : undefined
  const categoriaMissing = attempted && fields.categoriaId === undefined

  const setTipo = (tipo: TipoMovimiento) => setFields((f) => ({ ...f, tipo }))
  const setAmountRaw = (amountRaw: string) => setFields((f) => ({ ...f, amountRaw }))
  const setFecha = (fecha: string) => setFields((f) => ({ ...f, fecha }))
  const setNota = (nota: string) => setFields((f) => ({ ...f, nota }))

  const selectCategoria = (categoria: Categoria) =>
    setFields((f) => ({ ...f, categoriaId: categoria.id, seccionId: categoria.seccionId }))

  const reset = () => {
    setFields(defaultsFor(mode, initial, locale))
    setAttempted(false)
    setSubmitAttempts(0)
  }

  const applyParsedFields = (patch: MovimientoFormPatch) =>
    setFields((f) => {
      const next: FormFields = { ...f }
      if (patch.tipo !== undefined) next.tipo = patch.tipo
      if (patch.monto !== undefined) next.amountRaw = formatAmountForInput(patch.monto, locale)
      if (patch.fecha !== undefined) next.fecha = patch.fecha
      if (patch.nota !== undefined) next.nota = patch.nota
      if (patch.categoriaId !== undefined) {
        next.categoriaId = patch.categoriaId
        next.seccionId =
          categorias.find((c) => c.id === patch.categoriaId)?.seccionId ?? f.seccionId
      }
      return next
    })

  const submit = async () => {
    if (submitting) return
    setAttempted(true)
    setSubmitAttempts((n) => n + 1)
    if (!parsedAmount.ok || fields.categoriaId === undefined || fields.seccionId === undefined)
      return

    setSubmitting(true)
    try {
      const nota = fields.nota.trim() || undefined
      if (mode === 'create') {
        const ok = await createMovimiento({
          fecha: fields.fecha,
          seccion: fields.seccionId,
          categoria: fields.categoriaId,
          tipo: fields.tipo,
          monto: parsedAmount.value,
          moneda: monedaPrincipal,
          nota,
        })
        if (ok) {
          setFields(defaultsFor('create', undefined, locale))
          setAttempted(false)
          onSaved()
        }
      } else if (initial) {
        const ok = await updateMovimiento(initial.id, {
          fecha: fields.fecha,
          seccion: fields.seccionId,
          categoria: fields.categoriaId,
          tipo: fields.tipo,
          monto: parsedAmount.value,
          nota,
        })
        if (ok) onSaved()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return {
    tipo: fields.tipo,
    setTipo,
    amountRaw: fields.amountRaw,
    setAmountRaw,
    amountErrorReason,
    fecha: fields.fecha,
    setFecha,
    categoriaId: fields.categoriaId,
    selectCategoria,
    categoriaMissing,
    nota: fields.nota,
    setNota,
    submitting,
    submit,
    submitAttempts,
    reset,
    applyParsedFields,
  }
}
