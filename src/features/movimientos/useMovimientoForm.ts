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

export interface MovimientoFormPatch {
  tipo?: TipoMovimiento
  monto?: number
  fecha?: string
  nota?: string
  categoriaId?: string
}

export interface UseMovimientoFormArgs {
  mode: MovimientoFormMode
  initial?: Movimiento
  locale: string
  monedaPrincipal: Moneda
  onSaved: () => void
}

export interface UseMovimientoFormResult {
  tipo: TipoMovimiento
  setTipo: (tipo: TipoMovimiento) => void
  amountRaw: string
  setAmountRaw: (raw: string) => void
  amountErrorReason?: AmountErrorReason
  fecha: string
  setFecha: (iso: string) => void
  categoriaId?: string
  selectCategoria: (categoria: Categoria) => void
  categoriaMissing: boolean
  nota: string
  setNota: (value: string) => void
  submitting: boolean
  submit: () => Promise<void>
  submitAttempts: number
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
    }
  }
  return {
    tipo: 'gasto',
    amountRaw: '',
    fecha: todayIso(),
    nota: '',
    categoriaId: undefined,
  }
}

export const useMovimientoForm = ({
  mode,
  initial,
  locale,
  monedaPrincipal,
  onSaved,
}: UseMovimientoFormArgs): UseMovimientoFormResult => {
  const createMovimiento = useDataStore((s) => s.createMovimiento)
  const updateMovimiento = useDataStore((s) => s.updateMovimiento)

  const [fields, setFields] = useState<FormFields>(() => defaultsFor(mode, initial, locale))
  const [submitting, setSubmitting] = useState(false)
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
    setFields((f) => ({ ...f, categoriaId: categoria.id }))

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
      if (patch.categoriaId !== undefined) next.categoriaId = patch.categoriaId
      return next
    })

  const submit = async () => {
    if (submitting) return
    setAttempted(true)
    setSubmitAttempts((n) => n + 1)
    if (!parsedAmount.ok || fields.categoriaId === undefined) return

    setSubmitting(true)
    try {
      const nota = fields.nota.trim().replaceAll(/\s+/g, ' ') || undefined
      if (mode === 'create') {
        const ok = await createMovimiento({
          fecha: fields.fecha,
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
