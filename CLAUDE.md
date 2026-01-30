# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

## Deployment

```bash
npm run build && npx netlify deploy --prod --dir=.next
```

Live URL: https://sleep-schedule-app.netlify.app

## Architecture

Frontend-only Next.js 16 app (App Router) with Tailwind CSS. No backend - all schedule calculation happens client-side.

### Key Files
- `src/app/page.tsx` - Main component with all UI and logic (single-file app)
- `src/app/globals.css` - Custom styles including night sky with stars
- `src/lib/schedule.ts` - Original schedule calculation logic (now merged into page.tsx)

### Data Model (from Sasha Romary's sleep guide)

**Awake windows by age:**
- 0-3 months: 45-60 min
- 3-6 months: 1.5-2.5 hrs (90-150 min)
- 6-9 months: 2-3 hrs (120-180 min)
- 9-12 months: 3-4 hrs (180-240 min)

**Nap durations:**
- Regular naps: 30-120 min depending on age
- Last nap (catnap): 20-45 min

### UI Features
- Vertical timeline (5am-11pm)
- Night sky background with CSS stars (::before and ::after pseudo-elements)
- Draggable wake/bedtime markers (thin yellow lines)
- Draggable nap blocks (edge zones for resize, middle for move)
- Warning indicators (⚠) when values outside recommended ranges
- CTA button for booking discovery call

### Schedule State
```typescript
interface Schedule {
  wakeTime: number;      // minutes from midnight
  bedtime: number;       // minutes from midnight
  naps: NapBlock[];      // array of {startMinutes, endMinutes}
}
```

### Drag Interactions
- **Wake/Bedtime lines**: Drag to adjust time
- **Nap edges** (top/bottom 12px): Resize nap duration
- **Nap middle**: Move entire nap (duration preserved)

## Design Decisions
- No emojis in UI (clean, professional look)
- Pastel colors: yellow for wake/bedtime, indigo for naps, amber for awake windows
- Warnings as icons (⚠) not verbose text
- Single continuous night sky (no seams between header and timeline)
