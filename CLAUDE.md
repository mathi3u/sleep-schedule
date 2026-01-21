# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

## Architecture

Frontend-only Next.js app (App Router) with Tailwind CSS. No backend - all schedule calculation happens client-side.

**Key files:**
- `src/app/page.tsx` - Main page with onboarding form and schedule display
- `src/lib/schedule.ts` - Schedule calculation logic (awake windows, nap times, bedtime)

**Data model (from Sasha Romary's sleep guide):**
- Awake windows by age: 0-3mo (45-60min), 3-6mo (1.5-2.5hrs), 6-9mo (2-3hrs), 9-12mo (3-4hrs)
- Schedule generated from: baby's age, number of naps, wake time
