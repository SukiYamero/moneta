# Wave 2.2

**Goal.** Fix loading-state flashing across screens, and let someone use the app without a Google account.

**Why.** Wave 2's screens each hand-rolled their own loading treatment and flashed a loader even on fast loads; and identity was still a hard gate in front of an otherwise local-first app.

- Loading states — one shared skeleton/anti-flash system (`usePendingDelay`, `Skeleton`, `ScreenLoading`) so a fast load shows nothing and a slow one never blanks the screen's chrome (specs.md §10.9).
- Guest entry — a distinct `guest` auth state that skips login and the Drive-permission screen, never synthesizes a fake user, and can't bypass a device's PIN lock (specs.md §10.10).
