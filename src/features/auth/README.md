# src/features/auth

Login UI and the route guard that sits in front of the app.

- `LoginScreen.tsx` — "Sign in with Google" screen, shown while
  unauthenticated.
- `RequireAuth.tsx` — route guard: renders `children` once authenticated,
  otherwise renders `LoginScreen`.

Both read `useAuthStore` (`@/lib/authStore`) for state; neither holds local
auth state of its own.
