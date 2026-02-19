# Logic Looper

Daily puzzle game focused on retention: deterministic daily challenges, streak mechanics, GitHub-style heatmap, offline-first play, and minimal backend cost.

## Highlights
- Deterministic puzzle generation by date seed
- 5 rotating puzzle types with client-side validation
- Streak tracking + 365/366-day contribution heatmap
- IndexedDB-first storage with offline resume
- Smart batch sync (`/sync/daily-scores`, `/sync/achievements`)
- Google auth, guest mode, and Truecaller-ready flow

## Tech Stack
| Layer | Stack |
|---|---|
| Frontend | React 18, Redux Toolkit, Tailwind, Framer Motion, Day.js, CryptoJS, `idb` |
| Backend | Node.js, Express, Prisma, PostgreSQL, JWT, rate limiting |
| Testing | Vitest, Jest, React Testing Library, Playwright |

## Architecture (Client-First)
```text
Frontend (primary logic + storage)
  -> puzzle engine + validator + streak + heatmap + IndexedDB
  -> batch sync queue when online
Backend (minimal writes)
  -> auth + sync upsert + leaderboard
```

## Quick Start
```bash
npm install
npm run dev
```

### Environment
`frontend/.env.local`
```bash
VITE_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

`backend/.env`
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
PORT=5000
```

## Scripts
```bash
npm run test
npm run test:e2e
npm run lint
npm run type-check
npm run bundle:check
npm run lighthouse:ci
npm run lighthouse:check
```

## Project Structure
```text
frontend/  React app, puzzle engine, heatmap, offline storage
backend/   Express API, Prisma schema, auth/sync/leaderboard
e2e/       Playwright end-to-end tests
```