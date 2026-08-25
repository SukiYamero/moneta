import { useRef, useState, type ReactNode } from 'react'
import { Gift, House, Search, Trash2, Utensils } from 'lucide-react'
import {
  AmountField,
  BottomSheet,
  CenterModal,
  ConfirmDialog,
  DateChipPicker,
  IconAvatar,
  InfoButton,
  MovimientoRow,
  ScreenLoading,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  TagChip,
  TextField,
  Toggle,
} from '@/components/shared'
import { ToastKitDemo } from '@/components/shared/ToastKitDemo'
import { ICON_AVATAR_TINTS } from '@/components/shared/tintClasses'
import { CategoryFormModal } from '@/features/tags/CategoryFormModal'
import { CategoryPicker } from '@/features/tags/CategoryPicker'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import type { Categoria, Movimiento, Seccion, TipoMovimiento } from '@/lib/schema'

const SAMPLE_MOVEMENTS: Movimiento[] = [
  {
    id: 'kit_1',
    fecha: '2026-08-18',
    seccion: 'sec_personal',
    categoria: 'cat_sueldo',
    tipo: 'ingreso',
    monto: 4200000,
    moneda: 'COP',
    nota: 'Salario',
    createdAt: '2026-08-18T09:00:00.000Z',
  },
  {
    id: 'kit_2',
    fecha: '2026-08-17',
    seccion: 'sec_personal',
    categoria: 'cat_comida',
    tipo: 'gasto',
    monto: 18000,
    moneda: 'COP',
    createdAt: '2026-08-17T08:15:00.000Z',
  },
  {
    id: 'kit_3',
    fecha: '2026-08-10',
    seccion: 'sec_emprendimiento',
    categoria: 'cat_ventas',
    tipo: 'ingreso',
    monto: 1800000,
    moneda: 'COP',
    createdAt: '2026-08-10T14:30:00.000Z',
  },
]

const SAMPLE_CATEGORIAS: Categoria[] = [
  {
    id: 'cat_sueldo',
    nombre: 'Sueldo',
    seccionId: 'sec_personal',
    tipo: 'ingreso',
    icono: 'briefcase',
    color: 'emerald',
  },
  {
    id: 'cat_comida',
    nombre: 'Comida',
    seccionId: 'sec_personal',
    tipo: 'gasto',
    icono: 'utensils',
    color: 'amber',
  },
  {
    id: 'cat_ventas',
    nombre: 'Ventas',
    seccionId: 'sec_emprendimiento',
    tipo: 'ingreso',
    icono: 'trending-up',
    color: 'emerald',
  },
]

const SAMPLE_SECCIONES: Seccion[] = [
  { id: 'sec_personal', nombre: 'Personal', orden: 0 },
  { id: 'sec_emprendimiento', nombre: 'Emprendimiento', orden: 1 },
]

const SCOPE_OPTIONS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
] as const

const TYPE_OPTIONS = [
  { value: 'gasto', label: 'Gasto' },
  { value: 'ingreso', label: 'Ingreso' },
] as const

const SCOPE_OPTIONS_WITH_DISABLED = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana', disabled: true },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
] as const

const Section = ({ title, children }: { title: string; children: ReactNode }) => {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-fg-tertiary uppercase">{title}</h2>
      {children}
    </section>
  )
}

/** Dev-only gallery for src/components/shared/** — gated on import.meta.env.DEV in router.tsx. */
export const Kit = () => {
  const { locale, dateFnsLocale } = useLocaleFormatting()
  const [scope, setScope] = useState<(typeof SCOPE_OPTIONS)[number]['value']>('week')
  const [scopeWithDisabled, setScopeWithDisabled] =
    useState<(typeof SCOPE_OPTIONS_WITH_DISABLED)[number]['value']>('day')
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]['value']>('gasto')
  const [notifications, setNotifications] = useState(true)
  const [darkTheme, setDarkTheme] = useState(false)
  const [selectedTag, setSelectedTag] = useState(false)
  const [date, setDate] = useState('2026-08-18')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  // Nested-overlay demo: the delete-confirm CenterModal opens from inside
  // the Movement BottomSheet — the real, reachable flow the overlay stack
  // (useOverlay.ts) exists for.
  const [movementSheetOpen, setMovementSheetOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  // initialFocus demo: the amount input should get focus on open even
  // though it isn't the sheet's first focusable descendant.
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const [addSheetAmount, setAddSheetAmount] = useState('')
  const [textFieldValue, setTextFieldValue] = useState('')
  const [amountFieldValue, setAmountFieldValue] = useState('')
  const [pickerTipo, setPickerTipo] = useState<TipoMovimiento>('gasto')
  const [pickerSelectedId, setPickerSelectedId] = useState<string | undefined>('cat_comida')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [categoryModalCategoria, setCategoryModalCategoria] = useState<Categoria | undefined>()
  const [categoryModalInitialName, setCategoryModalInitialName] = useState<string | undefined>()

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 p-5 pb-24">
      <h1 className="text-lg font-extrabold">Shared UI kit</h1>

      <Section title="Skeleton / SkeletonGroup">
        <SkeletonGroup label="Cargando…" className="flex flex-col gap-2.5">
          <Skeleton className="h-17 rounded-3xl" />
          <Skeleton className="h-16.5 rounded-xl" />
          <Skeleton className="h-16.5 rounded-xl" />
        </SkeletonGroup>
      </Section>

      <Section title="ScreenLoading">
        <div className="overflow-hidden rounded-3xl border border-border-subtle">
          <ScreenLoading className="min-h-72" />
        </div>
      </Section>

      <Section title="IconAvatar — sizes">
        <div className="flex items-center gap-3">
          <IconAvatar icon={House} tint="emerald" size="sm" />
          <IconAvatar icon={House} tint="emerald" size="md" />
          <IconAvatar icon={House} tint="emerald" size="lg" />
        </div>
      </Section>

      <Section title="IconAvatar — tints">
        <div className="flex flex-wrap gap-3">
          {ICON_AVATAR_TINTS.map((tint) => (
            <IconAvatar key={tint} icon={Gift} tint={tint} />
          ))}
        </div>
      </Section>

      <Section title="MovimientoRow">
        <div className="flex flex-col gap-2.5">
          {SAMPLE_MOVEMENTS.map((m) => (
            <MovimientoRow
              key={m.id}
              movimiento={m}
              categorias={SAMPLE_CATEGORIAS}
              onClick={() => {}}
              locale={locale}
              dateFnsLocale={dateFnsLocale}
            />
          ))}
          <MovimientoRow
            movimiento={SAMPLE_MOVEMENTS[1]!}
            categorias={SAMPLE_CATEGORIAS}
            pending
            meta="Estimado · próx. semana"
            locale={locale}
            dateFnsLocale={dateFnsLocale}
          />
        </div>
      </Section>

      <Section title="TagChip">
        <div className="flex flex-wrap gap-2">
          <TagChip
            icon={Utensils}
            label="Comida"
            tint="amber"
            selected={selectedTag}
            onClick={() => setSelectedTag((s) => !s)}
          />
          <TagChip icon={House} label="Hogar" tint="emerald" />
          <TagChip icon={Gift} label="Regalo" tint="purple" selected />
          <TagChip icon={Utensils} label="Sin categoría" tint="neutral" selected />
          <TagChip icon={Utensils} label="Deshabilitado" tint="neutral" disabled />
        </div>
      </Section>

      <Section title="CategoryPicker + CategoryFormModal">
        <SegmentedControl
          options={[...TYPE_OPTIONS]}
          value={pickerTipo}
          onChange={setPickerTipo}
          aria-label="Tipo (demo del picker)"
        />
        <CategoryPicker
          categorias={SAMPLE_CATEGORIAS}
          tipo={pickerTipo}
          selectedId={pickerSelectedId}
          onSelect={(c) => setPickerSelectedId(c.id)}
          onCreateRequested={(query) => {
            setCategoryModalCategoria(undefined)
            setCategoryModalInitialName(query)
            setCategoryModalOpen(true)
          }}
        />
        <button
          type="button"
          onClick={() => {
            setCategoryModalCategoria(SAMPLE_CATEGORIAS[0])
            setCategoryModalInitialName(undefined)
            setCategoryModalOpen(true)
          }}
          className="min-h-11 self-start rounded-md bg-secondary px-4 text-sm font-bold text-secondary-foreground"
        >
          Editar “Sueldo”
        </button>
        {/* Kit.tsx never calls dataStore.load(), so Config stays null here —
            upsertCategoria() no-ops rather than throwing (dataStore.ts's own
            guard). This section demos the picker/modal's UI and interaction
            pattern, not a full write round-trip. */}
        <CategoryFormModal
          open={categoryModalOpen}
          onClose={() => setCategoryModalOpen(false)}
          tipo={pickerTipo}
          secciones={SAMPLE_SECCIONES}
          categorias={SAMPLE_CATEGORIAS}
          categoria={categoryModalCategoria}
          initialName={categoryModalInitialName}
        />
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          options={[...SCOPE_OPTIONS]}
          value={scope}
          onChange={setScope}
          aria-label="Alcance"
        />
        <SegmentedControl
          options={[...TYPE_OPTIONS]}
          value={type}
          onChange={setType}
          aria-label="Tipo"
        />
        <SegmentedControl
          options={[...SCOPE_OPTIONS_WITH_DISABLED]}
          value={scopeWithDisabled}
          onChange={setScopeWithDisabled}
          aria-label="Alcance con opción deshabilitada"
        />
      </Section>

      <Section title="Toggle">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 text-sm font-semibold">
            <Toggle
              checked={notifications}
              onCheckedChange={setNotifications}
              aria-label="Notificaciones"
            />
            Notificaciones
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <Toggle checked={darkTheme} onCheckedChange={setDarkTheme} aria-label="Tema oscuro" />
            Tema oscuro
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <Toggle
              checked={false}
              onCheckedChange={() => {}}
              disabled
              aria-label="Deshabilitado"
            />
            Deshabilitado
          </label>
        </div>
      </Section>

      <Section title="Toast (no screen raises one until Wave 3)">
        <ToastKitDemo />
      </Section>

      <Section title="TextField">
        <TextField
          label="Descripción"
          value={textFieldValue}
          onChange={setTextFieldValue}
          placeholder="Ej: Almuerzo con el equipo"
        />
        <TextField
          label="Nombre de categoría"
          value=""
          onChange={() => {}}
          error="Ya existe una categoría con ese nombre"
        />
      </Section>

      <Section title="AmountField">
        <AmountField
          label="Monto"
          value={amountFieldValue}
          onChange={setAmountFieldValue}
          locale={locale}
          placeholder="0"
        />
        <AmountField
          label="Monto (con error)"
          value="12.34.56"
          onChange={() => {}}
          locale={locale}
          error="El monto no es válido"
        />
      </Section>

      <Section title="InfoButton">
        <InfoButton onClick={() => setInfoOpen(true)} label="Sobre el balance" />
      </Section>

      <Section title="DateChipPicker">
        <DateChipPicker
          value={date}
          onChange={setDate}
          locale={locale}
          dateFnsLocale={dateFnsLocale}
        />
      </Section>

      <Section title="BottomSheet / CenterModal">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            Abrir sheet
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="min-h-11 rounded-md bg-secondary px-4 text-sm font-bold text-secondary-foreground"
          >
            Abrir modal
          </button>
          <button
            type="button"
            onClick={() => setMovementSheetOpen(true)}
            className="min-h-11 rounded-md bg-secondary px-4 text-sm font-bold text-secondary-foreground"
          >
            Sheet anidado
          </button>
          <button
            type="button"
            onClick={() => setAddSheetOpen(true)}
            className="min-h-11 rounded-md bg-secondary px-4 text-sm font-bold text-secondary-foreground"
          >
            Sheet con initialFocus
          </button>
        </div>
      </Section>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ariaLabel="Ejemplo de BottomSheet"
      >
        <div className="flex flex-col gap-3 pb-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Search className="size-4" aria-hidden="true" /> Ejemplo de contenido
          </div>
          <p className="text-sm text-fg-secondary">
            Arrastrá el handle hacia abajo, tocá el fondo, o presioná Escape para cerrar.
          </p>
        </div>
      </BottomSheet>

      <CenterModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ariaLabel="Ejemplo de CenterModal"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-base font-extrabold">Confirmación</div>
          <p className="text-sm text-fg-secondary">Este es el contenido de un CenterModal.</p>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="mt-3 min-h-11 w-full rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            Cerrar
          </button>
        </div>
      </CenterModal>

      <CenterModal open={infoOpen} onClose={() => setInfoOpen(false)} ariaLabel="Sobre el balance">
        <div className="flex flex-col gap-2">
          <div className="text-base font-extrabold">Tu balance</div>
          <p className="text-sm text-fg-secondary">
            Es todo lo que entró menos todo lo que salió, sumando cada movimiento que registraste.
          </p>
        </div>
      </CenterModal>

      {/* Nested-overlay demo: proves the overlay stack (useOverlay.ts) — the
          delete-confirm CenterModal is the topmost overlay while it's open:
          it gets initial focus, traps Tab, and Escape closes it first. */}
      <BottomSheet
        open={movementSheetOpen}
        onClose={() => setMovementSheetOpen(false)}
        ariaLabel="Movimiento (con confirmación anidada)"
      >
        <div className="flex flex-col gap-3 pb-2">
          <div className="text-sm font-bold">Sueldo</div>
          <p className="text-sm text-fg-secondary">Ejemplo de sheet con un CenterModal anidado.</p>
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-danger/15 px-4 text-sm font-bold text-danger"
          >
            <Trash2 className="size-4" aria-hidden="true" /> Eliminar
          </button>

          <ConfirmDialog
            open={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            onConfirm={() => {
              setDeleteConfirmOpen(false)
              setMovementSheetOpen(false)
            }}
            title="¿Eliminar este movimiento?"
            description="Esta acción no se puede deshacer."
            confirmLabel="Eliminar"
            cancelLabel="Cancelar"
            destructive
          />
        </div>
      </BottomSheet>

      {/* initialFocus demo: the amount input gets focus on open even though
          it isn't the sheet's first focusable descendant. */}
      <BottomSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        ariaLabel="Agregar movimiento"
        initialFocus={amountInputRef}
      >
        <div className="flex flex-col gap-3 pb-2">
          <SegmentedControl
            options={[...TYPE_OPTIONS]}
            value={type}
            onChange={setType}
            aria-label="Tipo de movimiento"
          />
          <AmountField
            label="Monto"
            value={addSheetAmount}
            onChange={setAddSheetAmount}
            locale={locale}
            ref={amountInputRef}
          />
        </div>
      </BottomSheet>
    </main>
  )
}
