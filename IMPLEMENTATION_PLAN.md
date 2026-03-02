# School App - Web + Android Implementation Plan

## Architecture
```
Web App (PWA) + Android App (Expo) ──▶ Cloudflare Worker ──▶ Google Sheets
```

---

## Phase 1: Backend Preparation
**Status:** ✅ Mostly Ready (existing API works)
- Reuse existing Cloudflare Worker + Google Sheets backend
- No changes needed for basic Android connectivity

---

## Phase 2: Web PWA Upgrade (3-5 days)

| Task | Description |
|------|-------------|
| 2.1 | Create `public/manifest.json` - PWA manifest |
| 2.2 | Create `public/sw.js` - Service Worker for offline |
| 2.3 | Add offline fallback page |
| 2.4 | Configure caching strategies |

---

## Phase 3: Shared API Layer (2-3 days)

| Task | Description |
|------|-------------|
| 3.1 | Extract API logic from `public/js/api.js` |
| 3.2 | Create shared package (`shared/api/`) |
| 3.3 | Add TypeScript types |

---

## Phase 4: Android App - Setup (2-3 days)

| Task | Description |
|------|-------------|
| 4.1 | Initialize Expo project |
| 4.2 | Install dependencies (SQLite, navigation, etc.) |
| 4.3 | Configure app icon and splash screen |

---

## Phase 5: Android App - Authentication (3-4 days)

| Task | Description |
|------|-------------|
| 5.1 | Login screen with Material Design 3 |
| 5.2 | Registration screen |
| 5.3 | Token storage (EncryptedSharedPreferences) |
| 5.4 | Auto-refresh token logic |

---

## Phase 6: Android App - Core Features (7-10 days)

| Task | Description |
|------|-------------|
| 6.1 | Dashboard (role-based) |
| 6.2 | Student management (CRUD) |
| 6.3 | Attendance marking & viewing |
| 6.4 | Marks/Grades |
| 6.5 | Timetable |
| 6.6 | Noticeboard |

---

## Phase 7: Offline-First Implementation (4-5 days)

| Task | Description |
|------|-------------|
| 7.1 | Setup SQLite (Room) database |
| 7.2 | Implement local caching for static data |
| 7.3 | Sync logic (pull-to-refresh) |
| 7.4 | Queue offline mutations |

---

## Phase 8: Testing & Deployment (3-5 days)

| Task | Description |
|------|-------------|
| 8.1 | Test offline scenarios |
| 8.2 | Build Android APK |
| 8.3 | Deploy web PWA |
| 8.4 | Submit to Play Store (optional) |

---

## Summary

| Phase | Duration |
|-------|----------|
| Phase 1: Backend | ~0 days (ready) |
| Phase 2: Web PWA | 3-5 days |
| Phase 3: Shared API | 2-3 days |
| Phase 4: Android Setup | 2-3 days |
| Phase 5: Auth | 3-4 days |
| Phase 6: Core Features | 7-10 days |
| Phase 7: Offline | 4-5 days |
| Phase 8: Testing | 3-5 days |
| **Total** | **~25-35 days** |

---

## Tech Stack Decisions

- **Android:** React Native with Expo (Recommended)
- **UI:** Material Design 3
- **Offline:** Yes - Offline-first with SQLite
- **Backend:** Reuse existing Cloudflare Worker API
