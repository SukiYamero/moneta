import { useState } from 'react'
import { Outlet } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'
import { ProfileSheet } from '@/features/profile'
import {
  AddMovimientoSheet,
  MovimientoSheet,
  useMovimientoSheetStore,
} from '@/features/movimientos'

export const AppShell = () => {
  const [profileOpen, setProfileOpen] = useState(false)
  const addOpen = useMovimientoSheetStore((s) => s.addOpen)
  const openAdd = useMovimientoSheetStore((s) => s.openAdd)

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <div className="flex-1 overflow-y-auto overscroll-y-contain pb-(--bottom-nav-clearance)">
        <Outlet />
      </div>
      <BottomNav
        profileOpen={profileOpen}
        onOpenProfile={() => setProfileOpen(true)}
        addOpen={addOpen}
        onOpenAdd={openAdd}
      />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <AddMovimientoSheet />
      <MovimientoSheet />
    </div>
  )
}
