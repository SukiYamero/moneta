import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Preferencias } from '@/lib/schema'
import { PreferencesEditor } from '@/features/settings/PreferencesEditor'

const preferencias = (overrides: Partial<Preferencias> = {}): Preferencias => ({
  tema: 'sistema',
  monedaPrincipal: 'COP',
  primerDiaSemana: 1,
  ...overrides,
})

describe('PreferencesEditor', () => {
  it('calls onChange with the numeric primerDiaSemana when the week-start toggle is tapped', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PreferencesEditor preferencias={preferencias()} onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: 'Domingo' }))
    expect(onChange).toHaveBeenCalledWith({ primerDiaSemana: 0 })
  })

  it('selects "seguir el dispositivo" when idioma is absent', () => {
    render(<PreferencesEditor preferencias={preferencias()} onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Seguir el dispositivo' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('selects the stored idioma’s endonym when one is set', () => {
    render(
      <PreferencesEditor preferencias={preferencias({ idioma: 'pt-BR' })} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('radio', { name: 'Português (Brasil)' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('writes idioma: undefined when "seguir el dispositivo" is tapped — the "seguir" round-trip', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PreferencesEditor preferencias={preferencias({ idioma: 'en' })} onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: 'Seguir el dispositivo' }))
    expect(onChange).toHaveBeenCalledWith({ idioma: undefined })
    expect(onChange.mock.calls[0]?.[0]).toHaveProperty('idioma')
  })

  it('writes the picked SupportedLocale when a language row is tapped', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PreferencesEditor preferencias={preferencias()} onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: 'English' }))
    expect(onChange).toHaveBeenCalledWith({ idioma: 'en' })
  })

  it('writes the picked moneda', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PreferencesEditor preferencias={preferencias()} onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: 'USD' }))
    expect(onChange).toHaveBeenCalledWith({ monedaPrincipal: 'USD' })
  })
})
