# DENTEX UI Migration Plan

## Repository baseline

- Next.js `16.3.5`, React `19.2.3`, App Router, JavaScript/JSX, CSS Modules.
- `src/app/layout.js` currently mounts `Navbar`, `Footer`, `ThemeToggleFAB`, auth/theme/state providers, and the PWA registration. It does not mount `src/components/layout/AppShell.jsx`.
- A first-pass shell already exists in `src/components/layout/` (AppShell, Sidebar, Topbar, StatusBar), along with reusable controls in `src/components/ui/`. These files are untracked user work and must be preserved and extended.
- `src/styles/tokens.css` describes a light clinical UI but is not imported. `src/app/globals.css` independently defines a purple palette and dark theme. Page CSS modules also use legacy variable aliases.
- App Router pages already exist for `/`, `/about`, `/login`, `/signup`, `/pending-approval`, `/diagnosis`, `/landmarks`, `/compare`, `/forensics`, `/tooth-chart`, `/learning`, `/education`, `/landmark-practice`, `/history`, `/admin`, and `/superadmin`. `/studio` and `/ai-assistant` do not exist.
- Diagnosis and other workflows use existing API calls, shared `DentalStateContext`, image/report/3D components, and should retain their existing behavior and contracts.
- Dependencies include NextAuth, Prisma, Three.js/React Three Fiber, Fabric, Framer Motion, and React Icons. No UI framework is configured; CSS Modules are the established component styling pattern.
- Local Next.js 16 App Router and CSS guidance was read from `node_modules/next/dist/docs/01-app/` before implementation.

## Incremental implementation

1. **Foundation:** load the existing clinical token system, align global defaults to light-only DENTEX blue, keep legacy CSS variable aliases, and add accessible base/focus behavior.
2. **Application composition:** mount the existing route-aware `AppShell` from the root layout; retain providers, metadata, manifest, and PWA setup. Remove duplicate global public navigation/footer and the visible theme FAB from root composition.
3. **Workspace chrome:** refine the shell, grouped navigation, responsive drawer/collapse, route breadcrumbs, profile actions, and clinical disclaimer. Keep role-based admin visibility and feature flag filtering; remove theme controls and model/inference labels from normal-user chrome.
4. **Overview:** add `/studio` as a focused workspace overview using existing routes and records where possible. Preserve all current route URLs.
5. **Workflow surfaces:** update the existing diagnosis, landmarks, compare, forensics, tooth-chart, learning, education, landmark-practice, history, admin, superadmin, and auth pages incrementally, reusing their existing state, APIs, and specialized viewers.
6. **Public experience:** update `/` and `/about` to the minimal DENTEX public identity. Do not use the particle component as the landing hero; leave the file intact.
7. **Assistant:** use the authenticated `/api/assistant` route for text conversation with the local ML service; pass diagnosis/lesson context when opening the assistant.
8. **QA:** run the existing build and lint scripts after implementation milestones; preserve the existing ML models, APIs, authentication, Prisma schema, and page functionality.

## Progress

- Completed the light-only DENTEX palette and compatibility layer, route-aware root composition, shell navigation refinements, protected `/studio` overview, landing page, About page, sign-in/sign-up/approval styling, and first-pass spacing/theme refinements across the existing workflow pages.
- Removed user-facing model/provider labels from clinical and learning workflows while preserving model selection and API branching. Technical controls remain on privileged admin routes.
- Added `/ai-assistant` and a separate rate-limited, authenticated local ML conversation endpoint. Diagnosis summaries and lesson context can be passed into the conversation.
- Added `/studio`, `/ai-assistant`, and `/api/assistant` to the existing Next.js 16 Proxy matcher so workspace data and assistant requests require an approved session.
- Final `npm.cmd run build` passes with the new `/studio`, `/ai-assistant`, and `/api/assistant` routes included.
- Final `npm.cmd run lint` exits successfully with 0 errors and 32 warnings. Warnings include existing `<img>` and hook dependency findings, plus vendored `.venv` files.

## Remaining review

- Inspect the layouts in a running browser at desktop and mobile widths, including the new mobile navigation drawer and assistant composer.
- Continue deeper page-by-page visual refinement where rendered review shows issues. No ML model, database, or existing API contract changes are part of this plan.
