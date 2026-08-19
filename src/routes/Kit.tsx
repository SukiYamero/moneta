import { useRef, useState, type ReactNode } from 'react'
import { Gift, House, Search, Trash2, Utensils } from 'lucide-react'
import {
  BottomSheet,
  CenterModal,
  DateChipPicker,
  IconAvatar,
  InfoButton,
  MovimientoRow,
  ScreenLoading,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  TagChip,
  Toggle,
  type IconAvatarTint,
} from '@/components/shared'
import { LockSettings } from '@/features/lock/LockSettings'
import { ToastKitDemo } from '@/components/shared/ToastKitDemo'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import type { Movimiento } from '@/lib/schema'

const TINTS: IconAvatarTint[] = [
  'emerald',
  'blue',
  'purple',
  'rose',
  'amber',
  'success',
  'danger',
  'info',
  'neutral',
]

const SAMPLE_MOVEMENTS: Movimiento[] = [
  {
    id: 'kit_1',
    fecha: '2026-08-18',
    seccion: 'sec_personal',
    categoria: 'Sueldo',
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
    categoria: 'Comida',
    tipo: 'gasto',
    monto: 18000,
    moneda: 'COP',
    createdAt: '2026-08-17T08:15:00.000Z',
  },
  {
    id: 'kit_3',
    fecha: '2026-08-10',
    seccion: 'sec_emprendimiento',
    categoria: 'Ventas',
    tipo: 'ingreso',
    monto: 1800000,
    moneda: 'COP',
    createdAt: '2026-08-10T14:30:00.000Z',
  },
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

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 p-5 pb-24">
      <h1 className="text-lg font-extrabold">Shared UI kit</h1>

      {/* The only way to enable/disable the PIN lock — moved here from
          Home when the app shell was rebuilt (docs/wave-2/track-l.md). */}
      <Section title="Lock (PIN vault — dev harness, moved from Home)">
        <LockSettings />
      </Section>

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
          {TINTS.map((tint) => (
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
              onClick={() => {}}
              locale={locale}
              dateFnsLocale={dateFnsLocale}
            />
          ))}
          <MovimientoRow
            movimiento={SAMPLE_MOVEMENTS[1]!}
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

          <CenterModal
            open={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            ariaLabel="Confirmar eliminación"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="text-base font-extrabold">¿Eliminar este movimiento?</div>
              <p className="text-sm text-fg-secondary">Esta acción no se puede deshacer.</p>
              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="min-h-11 flex-1 rounded-md bg-secondary text-sm font-bold text-secondary-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setMovementSheetOpen(false)
                  }}
                  className="min-h-11 flex-1 rounded-md bg-danger text-sm font-bold text-danger-foreground"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </CenterModal>
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
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Monto
            <input
              ref={amountInputRef}
              type="number"
              inputMode="decimal"
              className="min-h-11 rounded-md border border-border-subtle bg-surface-sunken px-3.5 text-base font-bold"
            />
          </label>
        </div>
      </BottomSheet>
    </main>
  )
}
