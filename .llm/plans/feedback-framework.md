# Plan: UI Feedback Framework

## Problem

Inconsistent error display across app:
- `/portal/login` — auth errors go to bottom-right toast (bad UX, user misses it)
- `/admin/login` — inline `Alert` (correct pattern, but only red/destructive)
- `/portal/signup` — inline `Alert` (correct pattern, but only red/destructive)
- `Alert` component has only 2 variants: `default` + `destructive` — no `warning`, `info`, `success`
- `toast` component also only `default` + `destructive`
- Portal login has dead `emailNotConfirmed` state (never set, errors go to toast instead)

## Goal

Single, consistent feedback system: inline alerts inside forms/cards for form-context errors; toasts for global/async events. Standardized variants: `error`, `warning`, `info`, `success`.

---

## Step 1 — Extend `Alert` component variants

**File:** `src/components/ui/alert.tsx`

Add variants using brand colors (tailwind classes from existing palette):

| Variant | Color | Use case |
|---|---|---|
| `error` | red/terracotta | Auth fail, validation fail, API error |
| `warning` | amber | Session expiry warning, partial success |
| `info` | blue/sage-toned | Neutral info, hints |
| `success` | green/sage | Success confirmation (post-signup, etc.) |

```ts
variants: {
  variant: {
    default: "bg-background text-foreground",
    destructive: "border-destructive/50 text-destructive ...",  // keep for compat
    error: "border-terracotta/40 bg-terracotta/5 text-terracotta [&>svg]:text-terracotta",
    warning: "border-amber-400/40 bg-amber-50 text-amber-800 [&>svg]:text-amber-600",
    info: "border-sage/40 bg-sage/5 text-charcoal [&>svg]:text-sage",
    success: "border-sage/30 bg-sage/10 text-charcoal [&>svg]:text-sage",
  }
}
```

Keep `destructive` alias pointing same as `error` for backward compat.

---

## Step 2 — Create `FormAlert` helper component

**File:** `src/components/ui/form-alert.tsx` (new)

Thin wrapper around `Alert` — handles null/empty guard, icon selection, animation:

```tsx
type FormAlertProps = {
  message?: string | null;
  variant?: "error" | "warning" | "info" | "success";
  className?: string;
}
// Maps variant → icon (AlertCircle, AlertTriangle, Info, CheckCircle2)
// Returns null if no message
// Adds: animate-in slide-in-from-top duration-300
```

Usage in any form:
```tsx
<FormAlert message={error} variant="error" />
<FormAlert message={successMsg} variant="success" />
```

---

## Step 3 — Extend `Toast` variants to match

**File:** `src/components/ui/toast.tsx`

Add same `warning`, `info`, `success` variants to `toastVariants` cva so `useToast()` calls can pass matching variants for global notifications.

---

## Step 4 — Fix `/portal/login` error handling

**File:** `src/pages/portal/login.tsx`

Current bug: `onSubmit` catch → `toast()` (bottom-right). Fix:
- Remove `useToast` import and hook
- Add `const [loginError, setLoginError] = useState<string | null>(null)`
- In catch: `setLoginError(error message)`
- Clear on new submit attempt
- Render `<FormAlert message={loginError} variant="error" />` above form fields
- Remove dead `emailNotConfirmed` state

---

## Step 5 — Normalize `/admin/login` and `/portal/signup`

Both already use inline `Alert` — just swap to `<FormAlert>` component with proper variant. Minor cleanup only.

---

## Step 6 — Update `useToast` for global events

Keep toast for non-form async events (booking confirmed, package purchased, etc.). Update callers to use new variants where appropriate:
- booking success → `success` variant
- payment failure → `error` variant
- partial/pending → `warning` variant

Audit: `grep -r "toast(" src/pages --include="*.tsx"` to find all callers.

---

## Execution order

1. Step 1 (Alert variants) — foundation, no breaking changes
2. Step 2 (FormAlert component) — new file, zero risk
3. Step 3 (Toast variants) — additive
4. Step 4 (portal login fix) — targeted bug fix, high value
5. Step 5 (admin + signup normalize) — cleanup
6. Step 6 (toast audit) — optional, do after core done

---

## Files touched

| File | Change |
|---|---|
| `src/components/ui/alert.tsx` | Add `error`/`warning`/`info`/`success` variants |
| `src/components/ui/form-alert.tsx` | New component |
| `src/components/ui/toast.tsx` | Add matching variants |
| `src/pages/portal/login.tsx` | Replace toast error → inline FormAlert |
| `src/pages/admin/login.tsx` | Swap Alert → FormAlert |
| `src/pages/portal/signup.tsx` | Swap Alert → FormAlert |

---

## Non-goals

- No modal/dialog-based errors (overkill for forms)
- No third-party notification library (sonner etc.) — use existing shadcn primitives
- No changes to toast position/behavior for global events
