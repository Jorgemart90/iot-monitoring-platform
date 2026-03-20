# API Reference

All services expose a REST API under the prefix `/api/v1`. All endpoints are documented in a **single unified Swagger UI** at **`http://localhost:3000/api/docs`** (API Gateway). The gateway merges the specs of all services dynamically — no need to open multiple tabs.

## Authentication

All endpoints (except `/auth/login` and `/health`) require a Bearer JWT token.

```bash
# Get token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## API Gateway (Port 3000)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/login | Get JWT access token |
| GET | /api/v1/health | Service health check |

## Device Service (Port 3001)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/devices | Create device |
| GET | /api/v1/devices | List devices (paginated) |
| GET | /api/v1/devices/:id | Get device by UUID |
| PATCH | /api/v1/devices/:id | Update device |
| DELETE | /api/v1/devices/:id | Delete device |

## Analytics Service (Port 3002)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/analytics/devices/:id/metrics | Aggregated metrics (avg/min/max) from Redis |
| GET | /api/v1/analytics/devices/:id/readings | Historical readings, paginated |

## Alerts Service (Port 3003)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/rules | Create alert rule |
| GET | /api/v1/rules | List all rules |
| GET | /api/v1/rules/:id | Get rule by UUID |
| PATCH | /api/v1/rules/:id | Update rule |
| DELETE | /api/v1/rules/:id | Delete rule |
| GET | /api/v1/alerts | List triggered alerts |
| GET | /api/v1/alerts/:id | Get alert by UUID |
| PATCH | /api/v1/alerts/:id/acknowledge | Acknowledge alert |
| PATCH | /api/v1/alerts/:id/resolve | Resolve alert |

## Notification Service (Port 3004)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/notifications/stream | SSE stream (text/event-stream) |
| GET | /api/v1/notifications/status | Connection count + status |

## Pagination

All list endpoints accept:
- `page` (default: 1)
- `limit` (default: 10, max: 100)

Response shape:
```json
{
  "data": [...],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```
