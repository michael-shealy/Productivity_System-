# 008 — Mobile-Friendly Redesign + Vercel-Ready Prep

## What changed

Major mobile-responsive overhaul of the dashboard, component extraction from the monolithic `page.tsx`, and deployment preparation for Vercel.

### Phase 1: Foundation
- **`layout.tsx`**: Updated metadata from "Create Next App" to "Daily System" with proper OpenGraph tags, added `viewport` export with `width=device-width, initialScale=1`, and `themeColor` for mobile browser chrome.
- **`globals.css`**: Added `overflow-x: hidden` on body, `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation` on interactive elements (prevents 300ms tap delay), and an `overscroll-contain` utility class.
- **Main container**: Changed `px-6 py-8` to `px-4 py-4 sm:px-6 sm:py-8` for tighter mobile padding.

### Phase 2: Component Extraction
Extracted 6 components from `page.tsx` into `frontend/src/components/`:

| Component | Purpose | Lines saved |
|---|---|---|
| `DashboardHeader.tsx` | Header, title, Chat/Sign out buttons, Practice/Tasks tab nav | ~70 |
| `MorningFlowBanner.tsx` | Morning flow status, step cards, start/resume/complete | ~125 |
| `InsightsSection.tsx` | AI insights grid with "why" explanations | ~40 |
| `IdentityCheck.tsx` | Daily identity metrics with date navigation and 5 toggles | ~105 |
| `CalendarMonthView.tsx` | Calendar grid with dual-mode (grid + list) toggle for mobile | ~90 |
| `ConnectionsPanel.tsx` | Todoist + Google Calendar connections, task/event CRUD forms | ~505 |

**Key design decision**: State stays in `page.tsx` and is passed as props. This avoids a risky state management refactor while getting the component decomposition benefits (readability, focused testing surface, smaller render trees).

### Phase 3: Mobile Responsive
- **ChatPanel**: Full-width on mobile (`w-full md:w-[400px]`), back arrow on mobile, safe area insets, overscroll containment.
- **Touch targets**: All date nav arrows, morning flow buttons, identity toggles, and habit log buttons increased to 44x44px minimum.
- **Calendar month view**: Added horizontal scroll wrapper on mobile for grid mode, plus a new List view mode (toggleable, persisted to localStorage, `md:hidden`).
- **Form grids**: All `grid-cols-2` and `grid-cols-3` form layouts changed to `grid-cols-1` on mobile with `sm:grid-cols-2`/`sm:grid-cols-3`.
- **Habits grid**: Changed from `sm:grid-cols-2` to `md:grid-cols-2` for single-column on phones.
- **Typography**: Added `text-wrap: balance` on headings, `tabular-nums` on numeric displays.

### Phase 4: Vercel Deployment Prep
- **`env.ts`**: New env validation helper with `getServerEnv()` and `getPublicEnv()` for fail-fast on missing variables.
- **`next.config.ts`**: Added `images.formats` config for AVIF/WebP optimization.
- **Login page**: Title updated to "Daily System" for consistency.

### Phase 5: Accessibility & Guidelines
- Added `focus-visible:ring-2 focus-visible:ring-indigo-500` to interactive elements across all extracted components.
- Added `aria-label` to icon-only buttons (close, nav arrows).
- Added `inputMode="numeric"` on priority fields, `spellCheck={false}` on ID inputs.

## Concepts for a data scientist learning web dev

### Responsive design with Tailwind
Tailwind uses a **mobile-first** approach. Plain classes like `px-4` apply to ALL screen sizes. Prefixed classes like `sm:px-6` apply at that breakpoint AND above. So `px-4 sm:px-6 md:px-8` means: 4 on mobile, 6 on tablets, 8 on desktop. Think of it like nested `if` statements from small to large.

### Component extraction strategy
When extracting from a monolith, the key question is: **where does state live?** Two approaches:
1. **Props down** (what we did): State stays in the parent, components are "presentational". Simple, safe, but lots of props.
2. **State colocated**: Move state into the component. Cleaner API but requires hooks/context — bigger refactor risk.

For a first pass, props-down is almost always safer. You can colocate state later as the API stabilizes.

### Touch target guidelines
The Web Content Accessibility Guidelines (WCAG) and Apple HIG both recommend minimum 44x44px touch targets. In Tailwind: `min-h-[44px] min-w-[44px]`. This is why mobile buttons need more padding than desktop ones — `py-1` works fine with a mouse cursor but is too small for a thumb.

### Viewport meta tag
Without `<meta name="viewport" content="width=device-width, initial-scale=1">` (which Next.js handles via the `viewport` export), mobile browsers will render the page at ~980px width and scale it down to fit. This is why sites without viewport meta look "zoomed out" on phones.
