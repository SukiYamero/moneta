import { BottomNav } from '@/components/shared'
import { HomeLoadingState } from '@/features/home/HomeLoadingState'

const noop = () => {}

export const PreContentSkeleton = () => (
  <div className="relative flex h-full flex-col bg-background text-foreground">
    <div className="flex-1 overflow-y-auto overscroll-y-contain pb-(--bottom-nav-clearance)">
      <main className="min-h-full px-5 pt-(--screen-inset-top) pb-1">
        <HomeLoadingState />
      </main>
    </div>
    <div inert>
      <BottomNav profileOpen={false} onOpenProfile={noop} addOpen={false} onOpenAdd={noop} />
    </div>
  </div>
)
