# Guest movement adoption — additive, repeatable, no accidental dismiss

Bringing guest movements into a Google-authenticated profile is now a copy,
never a move — the guest profile keeps its data unchanged. The login-time
prompt can no longer be dismissed by a backdrop tap or Escape, only its own
two buttons. A persistent Profile-screen entry (`GuestAdoptionSection`) makes
adoption available any time there's an unadopted guest movement, not just
once at login, and only ever copies the delta on a repeat use. Adopting
refreshes `dataStore` immediately, so the copied movements show up without a
reload.

Rules and implementation: `specs.md` §10.32.
