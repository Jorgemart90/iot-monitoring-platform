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

## Reglas por zona, rangos y resumen de alertas (feature/demo-auth-sessions)

`POST /api/v1/rules` y `PATCH /api/v1/rules/:id` aceptan adicionalmente:

| Campo | Tipo | Semántica |
|---|---|---|
| `zone` | string o null | Zona exacta (se recortan espacios para comparar); `""` = sin zona, null = cualquier zona |
| `deviceIds` | UUID[] o null | Selección explícita, 1–100 identificadores únicos; null = todos los del alcance |
| `customMessage` | string | Mensaje literal de hasta 500 caracteres; vacío usa el mensaje automático |
| `color` | string | Hexadecimal RGB `#RRGGBB` |
| `condition` | enum | `GREATER_THAN`, `LESS_THAN`, `EQUALS`, `BETWEEN`, `OUTSIDE_RANGE` |
| `thresholdMax` | number | Obligatorio en ambos rangos y estrictamente mayor que `threshold` |

`deviceId` conserva la compatibilidad de las reglas de un solo sensor. No se puede combinar un `deviceId` no nulo con `deviceIds`. Para convertir una regla antigua envía `deviceId: null` junto con `deviceIds`. La selección debe pertenecer a la zona y ser accesible al usuario, tanto al crear como al cambiar el alcance. Una selección ajena devuelve 403; una combinación de zona/dispositivo o rango inválido devuelve 400.

Una zona con lista nula cubre dinámicamente sus dispositivos; una lista explícita solo cubre los sensores seleccionados y que sigan en esa zona. Los usuarios DEMO siempre se limitan a sus dispositivos, incluso en reglas sin lista. Editar mensaje, color o estado no exige que los sensores hayan permanecido en la zona; cambiar el alcance vuelve a validarlos. La cuota DEMO cuenta reglas, no dispositivos asociados.

Ejemplo (sustituye los UUID):

```json
{
  "name": "Control de refrigeración",
  "zone": "Cámaras",
  "deviceIds": ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
  "metricField": "temperature",
  "condition": "OUTSIDE_RANGE",
  "threshold": 2,
  "thresholdMax": 8,
  "severity": "CRITICAL",
  "customMessage": "Revisar refrigeración de las cámaras",
  "color": "#336699"
}
```

`BETWEEN` incluye ambos extremos; `OUTSIDE_RANGE` excluye ambos extremos al disparar. Las temperaturas se expresan en Celsius, entre −273,15 y 500; humedad entre 0 y 100. Las reglas deben usar temperatura, humedad o presión y valores finitos. La API conserva los campos nuevos en la respuesta.

`GET /api/v1/alerts/summary` devuelve conteos completos de alertas `TRIGGERED`, sin filtro de fecha ni paginación, restringidos al propietario para DEMO:

```json
{"total": 7, "bySeverity": {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 1}}
```

Las alertas nuevas conservan `message` y `metadata.color`/`metadata.zone` de la regla al dispararse. El evento Kafka/SSE incluye `metadata`; cambiar una regla no reescribe alertas anteriores. La zona en estos metadatos representa el alcance configurado de la regla, no una instantánea de la ubicación de todos los sensores.

`Device.lastSeenAt` representa ahora la recepción confirmada de una lectura, usando el reloj del servidor y una transacción junto con la lectura. `DeviceReading.timestamp` conserva la fecha del sensor. El frontend considera activos los dispositivos con `lastSeenAt` durante los últimos diez minutos. Los valores históricos de `lastSeenAt` no se reescriben durante la migración.

Los mensajes automáticos de alertas (`message`, también en SSE) se generan en español y con unidades. Los mensajes personalizados conservan su contenido literal. Las alertas históricas no se reescriben; el frontend adapta la presentación del formato técnico anterior.

## Simulación manual o conjunta de métricas

`POST /api/demo/reading` en el frontend (puerto 5173) requiere autorización y `deviceId`. Acepta una o varias propiedades numéricas: `temperature` (−273,15..500 °C), `humidity` (0..100 %) y `pressure` (0..2000 hPa). Debe existir al menos una; vacío, null, texto, campos desconocidos o límites inválidos devuelven 400 sin publicar. Se mantiene la verificación de propiedad del dispositivo.

Ejemplo de envío exclusivo de humedad: `{ "deviceId": "UUID", "humidity": 65.5 }`. Para las tres: `{ "deviceId": "UUID", "temperature": 28, "humidity": 55, "pressure": 1013 }`.

La respuesta 202 incluye `reading` con las métricas efectivamente enviadas, fecha y metadatos del simulador. Ya no se añaden humedad y presión automáticamente a un envío de temperatura. La simulación continua y el recorrido envían explícitamente los tres campos. La lectura se procesa por MQTT, Kafka, métricas y alertas existentes.
