# Android App - Future Development Notes

## Architecture for Android App

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Android App    │────▶│  Cloudflare      │────▶│  Google Sheets  │
│  (Kotlin/JS)   │     │  Worker (Cache)  │     │  + App Script   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Current API Endpoints

| Endpoint | Method | Description | Cached |
|----------|--------|-------------|--------|
| `/login` | POST | Authenticate user | No |
| `/register` | POST | Register new user | No |
| `/logout` | POST | Logout user | No |
| `/verify` | POST | Verify session | No |
| `/getUsers` | POST | List users (admin) | Yes (5 min) |
| `/getRoles` | POST | List roles (admin) | Yes (10 min) |
| `/createRole` | POST | Create role (admin) | No |
| `/updateRole` | POST | Update role (admin) | No |
| `/deleteRole` | POST | Delete role (admin) | No |
| `/updateUserRole` | POST | Assign role (admin) | No |

## Pagination

Use `limit` and `offset` parameters:

```javascript
// Get first 10 users
api.getUsers(token, { limit: 10, offset: 0 })

// Get next 10 users
api.getUsers(token, { limit: 10, offset: 10 })
```

Response includes:
```json
{
  "success": true,
  "users": [...],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

## Caching Strategy

### Static Data (Cached on Cloudflare)
- Roles list: 10 minutes
- Config: 1 hour
- Timetable: 1 hour
- Noticeboard: 10 minutes
- Attendance: 5 minutes
- Marks: 5 minutes

### Dynamic Data (Never Cached)
- Login/Logout
- Verify session
- Any write operations (POST/PUT/DELETE)

## ETag Support

The API returns ETag headers. Use them for conditional requests:

```kotlin
// First request
val response = api.get("/api/attendance")
val etag = response.headers["ETag"]

// Subsequent requests - only fetch if changed
val conditionalRequest = Request.Builder()
    .header("If-None-Match", etag)
    .get()
    .build()
```

## Future Endpoints (To Be Implemented)

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Mark attendance
- Query params: `student_id`, `date`, `month`

### Noticeboard
- `GET /api/noticeboard` - Get notices
- `POST /api/noticeboard` - Create notice (admin/teacher)

### Timetable
- `GET /api/timetable` - Get class timetable
- Query params: `class_id`, `day`

### Marks/Grades
- `GET /api/marks` - Get student marks
- `POST /api/marks` - Add marks (teacher)

## Android App Guidelines

1. **Offline-First**: Cache static data locally using Room/SQLite
2. **Sync on Pull**: Only sync when user explicitly refreshes
3. **Token Management**: Store token securely (EncryptedSharedPreferences)
4. **Auto-Refresh**: Refresh token before expiry
5. **Batch Operations**: Use bulk APIs when updating multiple records

## Cloudflare KV for Cache (Optional)

For better caching, use Cloudflare KV:

```javascript
// In worker
import { KVNamespace } from '@cloudflare/workers-types';

export default {
  async fetch(request, env) {
    const myCache = await env.MY_CACHE.get('key');
    // ...
  }
}
```

## WebSocket for Real-time (Future)

Consider Cloudflare Durable Objects for real-time features like:
- Live attendance tracking
- Instant notifications
- Chat
