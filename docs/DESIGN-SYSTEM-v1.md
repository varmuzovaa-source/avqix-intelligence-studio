# AVQIX / Product design system v1.0

**Status:** design specification; not a claim of a completed production redesign.  
**Applies to:** AVQIX Intelligence Studio React UI, client-facing reports and future admin views.  
**Principle:** one product language, many client brands. Do not restyle product chrome when switching client accounts.

## 1. Product personality and visual direction
Clean professional marketing intelligence workspace: clear, restrained, fast to scan and actionable. Preserve existing brand DNA (warm near-white surfaces, graphite text, fresh lime accent), but use accent sparingly. Never sacrifice legibility for stylistic minimalism. Marketing data first, decoration second.

### Semantic colors
Existing project definitions in `src/styles.css` are the current source of truth; migrate gradually rather than introducing conflicting token sets.

| Role | Token | Usage |
|---|---|---|
| Canvas | `--background` | App backdrop |
| Elevated | `--card` | Cards, menus, panels |
| Navigation | `--sidebar` | Navigation rail |
| Primary text | `--foreground` | Headings, metric values |
| Secondary text | `--muted-foreground` | Support text, timestamps |
| Divider | `--border` | Subtle separators |
| Brand accent | `--primary` | Primary actions, selected navigation, focus states |
| Positive | `--positive` | Success metrics only |
| Destructive | `--destructive` | Error and destructive action |
| Data | `--chart-lime`, `--chart-gray`, `--chart-sage` | Stable graph encoding |

**Rules:** never use only color to indicate positive/negative performance. Use sign, value, label and accessible contrast. Sample/demo status must always be visibly labelled. Distinguish missing data from zero.

## 2. Typography
- Core family: Manrope (already integrated in `src/routes/__root.tsx`); fallback `system-ui, sans-serif`.
- Page title: 28–32px, weight 750–800, line height 1.2–1.35.
- Section heading: 18–22px, weight 700–750.
- Card title: 14–16px, weight 700.
- **Body UI:** 14–16px; 13px minimum for nondecorative dense tables; avoid current 8–11px informational text where practical.
- Supporting text: 12–14px with contrast AA wherever possible.
- Metric numbers: 28–36px, weight 750–800; use tabular numerals for alignment.
- One clear H1 per route. Page labels are not alternative headings.

## 3. Spacing, layout, breakpoints
- Base spacing increments: 4, 8, 12, 16, 24, 32, 48, 64px. Use one scale across all routes.
- Card padding: 20–24px desktop, 16px mobile.
- Main page content: max width 1440–1640px. Recommended side padding 32px desktop, 20px tablet, 16px mobile.
- Card grid gaps: 16–24px. Internal row gaps: 8–12px.
- Sidebar: currently 244px expanded and 80px collapsed. Do not change globally per page.
- Breakpoint intent: mobile < 640px, tablet 640–1023px, desktop >= 1024px. Verify actual CSS media queries in every implementation.
- On mobile, stack KPI cards (one or two columns depending on available width); preserve horizontal table scrolling and visible filters; never crop important values.

## 4. Components and states
Each component has **default, hover, keyboard-focus, disabled, loading, empty, error, success** states where relevant.

- Buttons: primary (one dominant action per section), secondary, ghost and destructive. Use verbs: “Aktualizovat data”, “Importovat CSV”, “Předat úkol”. Show loading/progress for network actions.
- Form fields: visible label, help, validation; errors adjacent to affected field; never placeholder as only label.
- KPI cards: label, value, unit, time period, source, trend context; clearly distinguish goal vs reality.
- Charts: title, axes and units, date window, source and updated-at; accessible table alternative where practical.
- Tables: accessible header cells, sorting affordances, visible search/filter state, empty state, exports; no clipped names.
- Recommendations: **problem → evidence → impact → suggested action → confidence → owner**, with explicit “proposed, not applied”.
- Status: “Živá data”, “CSV import”, “Ukázková data”, “Data chybí” as distinct semantic labels with text.
- Dialogs: keyboard Escape, focus management, clear destructive confirmations.
- Toasts: confirmation and actionable error, never as the only place essential information is shown.

## 5. Data UX and trust contract
- Never blend sample values with real values or imply a connector is authorized merely because it exists.
- Every significant metric must identify its data source and last update.
- If no data: a plain-language empty state with the exact next step.
- Do not recommend budget changes from inadequate evidence without explaining uncertainty.
- Label read-only operations. No publishing, emailing, budget edits or account mutations without user approval.
- For client-specific dashboards, allow KPI configuration per business model in `src/lib/business-models.ts`; do not fork UI styles.

## 6. Pages and navigation
1. Přehled: 4–6 KPIs, one insight summary, trends, channels, prioritized actions.
2. Cíle a rady: goal/current/variance, confidence, recommended action, delegate.
3. Kampaně: searchable, sortable, filterable campaign table, clear attribution caveats.
4. Datové zdroje: source status, import, last sync, freshness and failures.
5. Search Console: opportunities, search intent, priority actions, CSV source.
6. E-mailing: current import-based analysis with clearly marked limitations.
7. Úkoly: status/owner/due date; link recommendations to tasks.
8. Reporty: versioned client exports with accurate data provenance.
9. Nastavení: client and permission preferences and integration configuration.

## 7. Implementation map
- `src/styles.css`: CSS semantic tokens, layout and responsive rules. Do not add per-route hardcoded colors.
- `src/components/analytics/`: reusable product components.
- `src/components/ui/`: shared UI primitives.
- `src/lib/business-models.ts`: industry-specific KPI labels and sets.
- `src/lib/analytics-data.ts`: analytics and recommendations; demo status must be truthful.
- `src/routes/`: composed pages, avoid duplicated components.

## 8. Acceptance checklist before merge
- Screens reviewed at widths 320, 375, 768, 1024 and 1440px.
- All navigation and client/date filters work across routes.
- Body text and form controls are readable on iPhone; keyboard focus visible.
- No inconsistent radii, shadows, colors or random margins.
- Missing-data / demo-data states are explicit.
- `npm run build`, `npm test` and `npm run lint` executed and results recorded.
- No production API credentials in repo, HTML, or Vercel demo.
- User signs off preview; do not merge to `main` without approval.

## 9. Reuse for client websites
Reuse the *rules* (roles, spacing, typography hierarchy, CTA logic, responsive QA), not AVQIX-specific lime colors. For each new client, create a one-page brand mapping specifying palette, font pair, imagery, content voice and UX goal. In WordPress Elementor, map roles to Site Settings → Global Colors / Global Fonts; in React map them to semantic CSS variables.
