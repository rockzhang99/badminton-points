# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**星羽炮分榜 (StarCannon Leaderboard)** — A WeChat Mini Program for badminton club scoring, ranking, and fee splitting. Brand persona: "章一炮" (Bro Cannon), gameful and edgy.

Tech stack: Native WeChat Mini Program + TypeScript + WeChat Cloud Development (CloudBase). No external backend servers.

## Commands

All commands run from `miniprogram/`:

| Command | Purpose |
|---|---|
| `npm run compile` (or `tsc --noEmit`) | TypeScript type-check only |
| WeChat DevTools → Build | Compile WXML/WXSS/TS (built-in) |
| WeChat DevTools → Upload | Deploy mini program |
| Right-click cloudfunction → Upload & Deploy | Deploy individual cloud function |

There is no test framework. The project only has type-checking.

## Project Structure

```
miniprogram/
├── app.ts / app.json / app.wxss          — Entry: App() constructor, cloud init, global styles
├── types/index.ts                         — All domain types (PlayMode, Game, Match, Member, BillingSheet…)
├── typings/index.d.ts                     — IAppOption global type
├── utils/                                 — Core business engines (no UI dependency)
│   ├── play-modes.ts                      — 6 play mode configs (name, desc, player range, icon)
│   ├── match-engine.ts                    — Match generation algorithms for all 6 modes
│   ├── score-engine.ts                    — Cannon score formula (base × weight × win × penalty)
│   └── billing.ts                         — Fee splitting algorithm (court/shuttle/female discount)
├── pages/
│   ├── index/                             — Home: play mode cards + recent games
│   ├── cannon/
│   │   ├── create/                        — Create game: select mode, add players, import from roster
│   │   ├── match/                         — Match generation: court layout, reshuffle
│   │   ├── scoring/                       — Core scoring: swipe courts, +/- buttons, cannon events
│   │   └── result/                        — Results: MVP, cannon scores, share card
│   ├── leaderboard/total/                 — Leaderboard: 4 tab dimensions (total/weekly/max/anti-cannon)
│   ├── arsenal/
│   │   ├── history/                       — Game history list (reverse chronological)
│   │   ├── detail/                        — Game detail: ranking tab + match tab
│   │   └── members/                       — Player management: CRUD, cannon-fodder flag
│   ├── settlement/billing/                — Fee splitting: court/shuttle fees, female discount
│   └── mine/
│       ├── index/                         — Profile: stats, badges
│       └── badges/                        — Badge showcase
├── cloudfunctions/
│   ├── getLeaderboard/                    — Aggregated leaderboard query (top 100)
│   └── weeklyReset/                       — Scheduled weekly reset trigger
├── images/                                — Tab icons (placeholder)
├── project.config.json                    — WeChat DevTools config
├── tsconfig.json                          — TypeScript config (ES2020, CommonJS, strict)
└── package.json                           — Deps: miniprogram-api-typings, typescript ^5.3
```

## Architecture & Data Flow

### Linear Page Flow

```
index → create → match → scoring → result → billing
```

Pages pass complex game state via `getApp().globalData.currentGame` (a mutable object on the App instance). Small data (mode, player IDs) passes through URL query parameters.

### State Management

- **`app.globalData.currentGame`** — Active game object shared across the cannon flow pages
- **`app.globalData.userInfo`** — Cached user info (read from wx.getStorageSync on launch)
- **`wx.setStorageSync / wx.getStorageSync`** — Offline fallback: cached user info, recent games, billing data
- **Page `data`** — Local component state via `this.setData()`

### Offline Degradation Pattern

Every cloud call is wrapped in try/catch with local storage fallback:
```typescript
try { /* cloud call */ } catch { /* read from wx.getStorageSync */ }
```

### Cloud Database Collections

Two collections: `games` (match records with embedded matches, cannon scores, billing) and `members` (player profiles with aggregated stats). Cloud functions handle leaderboard aggregation and weekly reset. Client also has a full fallback leaderboard computation for when cloud functions are unavailable.

### Utility Engine Modules (no UI dependencies)

Each is a pure TypeScript module testable in isolation:
- **`play-modes.ts`** — Config map of 6 modes, filterable by player count
- **`match-engine.ts`** — Fisher-Yates shuffle, greedy pairing for rotation, bracket generation for elimination, cycle robin, AB-team five-feather
- **`score-engine.ts`** — `finalScore = baseScore × cannonWeight × winMultiplier × (1 - sum(cannonPenalties))`, capped at 30% penalty
- **`billing.ts`** — `share = courtFee/N + shuttleFee × (scoreRatio) - femaleDiscount`, with "Bro Cannon pays" override

## Coding Conventions

- **Comments**: Traditional Chinese. JSDoc-style for functions/types.
- **Naming**: `camelCase` for variables/functions, `PascalCase` for types/interfaces, `SCREAMING_SNAKE_CASE` for constants.
- **Imports**: Relative paths only (despite `@/*` alias in tsconfig).
- **Event handlers**: Naming pattern `on<Action>` (e.g., `onSelectMode`, `onAddPlayer`, `onStartGame`, `onFire`).
- **Async**: Primarily `async/await`.
- **WXS files**: Render-layer helper functions (name lookup, gender formatting) to avoid cross-layer communication overhead.
- **Share**: Every page implements `onShareAppMessage()`.
- **Game data passed via `app.globalData.currentGame`** — do not add new fields lightly; check if they need to survive page navigations or can be local state.
- **Adding a new play mode**: Add entry in `play-modes.ts` config, add generation logic in `match-engine.ts`, ensure `scoring/` handles the mode, ensure `result/` computes scores correctly.