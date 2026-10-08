# IoT Monitoring Platform

A production-ready IoT monitoring platform built with NestJS microservices, demonstrating real-time data processing, event-driven architecture, and modern backend patterns.

## Demo visual con Angular

Abre **http://localhost:5173** después de ejecutar `docker compose -p iot-demo-auth up -d --build`.

Pulsa **Crear mi demo** → **Preparar mi recorrido** → **Crear reglas del recorrido** → **Enviar lectura y recibir alertas** para ver un sensor, sus métricas y una alerta en tiempo real. En **Alertas**, reconoce y resuelve el evento. Para acceder como MASTER, usa la pestaña **Administrador** y las credenciales del `.env` de este checkout.

Envía temperaturas personalizadas en °C o °F, compara varios sensores por zona con zoom e historial y filtra o agrupa tus alertas por fecha, zona, dispositivo y tipo de alarma.

Consulta [la guía del frontend](docs/FRONTEND.md) para desarrollo local, sesiones, simulación y pruebas de navegador.

## Tech Stack

- **Framework**: NestJS (monorepo)
- **Frontend**: Angular 21 standalone components, served by the Docker frontend container
- **Database**: PostgreSQL + TypeORM
- **Message Broker**: Apache Kafka
- **IoT Protocol**: MQTT (Mosquitto)
- **Cache/PubSub**: Redis (ioredis)
- **Auth**: JWT (Passport.js)
- **Real-time**: Server-Sent Events (SSE)
- **API Docs**: Swagger/OpenAPI
- **Containers**: Docker + Docker Compose

## Architecture

```
IoT Devices → MQTT → Device Service → Kafka → Analytics Service
                                           ↘→ Alerts Service → Kafka → Notification Service → SSE → Clients
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 5173 | Angular dashboard, demo flow, and admin UI |
| api-gateway | 3000 | JWT auth, Swagger docs, routing |
| device-service | 3001 | CRUD devices, MQTT consumer, Kafka producer |
| analytics-service | 3002 | Kafka consumer, Strategy Pattern metrics, Redis cache |
| alerts-service | 3003 | Rule evaluation, Kafka consumer+producer |
| notification-service | 3004 | SSE streaming, Redis Pub/Sub |

## Quick Start

### Prerequisites
- Docker Desktop with Docker Compose v2
- Node.js compatible with Angular 21 and npm 9+ for local development only (see the [frontend guide](docs/FRONTEND.md))

### 1. Clone and setup
```bash
git clone <repo-url>
cd iot-monitoring-platform
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Set `MASTER_USERNAME` and `MASTER_PASSWORD` in `.env`; keep an existing `.env` rather than overwriting it.

### 2. Build and start the complete platform
```bash
docker compose -p iot-demo-auth up -d --build
docker compose -p iot-demo-auth ps
```

### 3. Open the application
- **Frontend**: http://localhost:5173
- **API documentation**: http://localhost:3000/api/docs
- **Kafka UI**: http://localhost:8081
- **Adminer**: http://localhost:8080

Choose **Crear mi demo** for a temporary DEMO session, or **Administrador** to sign in with the MASTER credentials from `.env`. The [frontend guide](docs/FRONTEND.md) covers the guided flow, account limits, and browser tests.

### 4. Run the frontend locally (optional)
With the Docker stack running, start Angular's development server:
```bash
cd apps/frontend
npm ci
npm start
```
In PowerShell, use `npm.cmd ci` and `npm.cmd start`. Open http://localhost:4200; the dev server proxies API, cookie, and SSE requests to the Docker stack.

To develop NestJS services locally, start their infrastructure dependencies and install the root dependencies:
```bash
docker compose -p iot-demo-auth up -d postgres redis kafka mosquitto zookeeper
npm ci
npm run start:api-gateway
# In another terminal:
npm run start:device-service
```
Use the other `start:*` scripts in `package.json` for additional services.

### 5. Run the IoT simulator
```bash
node scripts/mqtt-simulator.js 3 2000
# Simulates 3 devices publishing every 2 seconds
```

### Stop the platform
```bash
docker compose -p iot-demo-auth down
```
The database volume is retained. Add `-v` only when you intentionally want to delete persisted data.

## API Endpoints

### Auth and sessions (API Gateway :3000)
- `POST /api/v1/auth/login` — Sign in as the configured master user
- `POST /api/v1/auth/demo` — Create a temporary, limited demo session
- `POST /api/v1/auth/refresh` — Rotate the refresh token and renew access
- `POST /api/v1/auth/logout` — Revoke the current session
- `GET /api/v1/auth/me` — Current authenticated identity
- `GET /api/v1/auth/sessions` — Current user's sessions
- `DELETE /api/v1/auth/sessions/:id` — Revoke one session
- `GET /api/v1/health` — Health check

See [`docs/SECURITY.md`](docs/SECURITY.md) for roles, token handling and demo isolation.

### Devices (:3001)
- `POST /api/v1/devices` — Register device
- `GET /api/v1/devices` — List devices (paginated)
- `GET /api/v1/devices/:id` — Get device
- `PATCH /api/v1/devices/:id` — Update device
- `DELETE /api/v1/devices/:id` — Delete device

### Analytics (:3002)
- `GET /api/v1/analytics/devices/:id/metrics` — Aggregated metrics from Redis
- `GET /api/v1/analytics/devices/:id/readings` — Historical readings (paginated)

### Alerts (:3003)
- `POST /api/v1/rules` — Create alert rule
- `GET /api/v1/rules` — List rules
- `PATCH /api/v1/alerts/:id/acknowledge` — Acknowledge alert
- `PATCH /api/v1/alerts/:id/resolve` — Resolve alert

### Notifications (:3004)
- `GET /api/v1/notifications/stream` — SSE stream of real-time alerts
- `GET /api/v1/notifications/status` — Connection status

## Swagger Docs — Cómo usar la API

Toda la API está documentada en una **sola Swagger UI centralizada** en **`http://localhost:3000/api/docs`**.
El API Gateway fusiona dinámicamente los specs de los 5 servicios — auth, devices, analytics, alerts y notifications — en un único documento.

### Paso 1 — Autenticarse

> Todos los endpoints (excepto `/auth/login` y `/health`) requieren un token JWT.

1. Abre **`http://localhost:3000/api/docs`**
2. Expande **`POST /api/v1/auth/login`** → clic en **"Try it out"**
3. Ejecuta con los valores `MASTER_USERNAME` y `MASTER_PASSWORD` de tu archivo `.env`:
   ```json
   { "username": "admin", "password": "change-this-master-password" }
   ```
4. Copia el valor de `access_token` de la respuesta
5. Haz clic en el botón **"Authorize"** 🔒 (arriba a la derecha)
6. Ingresa el token con el prefijo `Bearer`:
   ```
   Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
7. Clic en **"Authorize"** → **"Close"**

A partir de aquí todos los requests incluyen el token automáticamente.

---

### Paso 2 — Registrar un dispositivo

En la misma Swagger UI (**`http://localhost:3000/api/docs`**), sección **`devices`**:

1. Expande **`POST /api/v1/devices`** → **"Try it out"**
2. Body de ejemplo:
   ```json
   {
     "name": "Sensor Sala Principal",
     "type": "MULTI_SENSOR",
     "location": "Edificio A, Piso 2"
   }
   ```
3. Ejecuta y copia el `id` (UUID) de la respuesta — lo necesitarás para Analytics

---

### Paso 3 — Crear una regla de alerta

En la misma Swagger UI, sección **`alerts`**:

1. Expande **`POST /api/v1/rules`** → **"Try it out"**
2. Body de ejemplo (dispara cuando temperatura > 35°C):
   ```json
   {
     "name": "Temperatura Alta",
     "metricField": "temperature",
     "condition": "GREATER_THAN",
     "threshold": 35,
     "severity": "HIGH",
     "isActive": true
   }
   ```

Condiciones disponibles: `GREATER_THAN`, `LESS_THAN`, `EQUALS`, `BETWEEN`
Severidades: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

---

### Paso 4 — Generar datos con el simulador

```bash
node scripts/mqtt-simulator.js 3 2000
# 3 dispositivos, publicando cada 2 segundos
```

El simulador crea automáticamente una sesión `DEMO`, registra hasta 3 dispositivos propios y publica por MQTT.

---

### Paso 5 — Consultar métricas

En la misma Swagger UI, sección **`analytics`**:

1. Expande **`GET /api/v1/analytics/devices/{id}/metrics`** → **"Try it out"**
2. Pega el UUID del dispositivo en el campo `id`
3. Ejecuta — verás las métricas en tiempo real desde Redis:
   ```json
   {
     "temperature": { "value": 28.4, "min": 15.1, "max": 44.9, "avg": 27.3, "count": 85 },
     "humidity":    { "value": 61.2, "min": 20.3, "max": 89.5, "avg": 54.8, "count": 85 }
   }
   ```

---

### Swagger unificado

Toda la documentación en una sola URL:

| URL | Servicios incluidos |
|-----|---------------------|
| **`http://localhost:3000/api/docs`** | auth · devices · analytics · alerts · notifications |

## Running Tests
```bash
npm test
npm run test:cov
```

## Monitoring & Observability

### Monitoring Tools URLs

| Tool | URL | Description |
|------|-----|-------------|
| Kafka UI | http://localhost:8081 | Topics, messages, consumer groups |
| Adminer (DB) | http://localhost:8080 | PostgreSQL tables and queries |
| **Swagger (todos los servicios)** | **http://localhost:3000/api/docs** | Auth · Devices · Analytics · Alerts · Notifications |

---

### Kafka UI — ver tópicos y mensajes

Inicia el contenedor si no está corriendo:
```bash
docker compose up -d kafka-ui
```

Abre **http://localhost:8081** y podrás:
- Ver los tópicos `device.readings` y `alert.triggered` en tiempo real
- Leer el payload JSON de cada mensaje publicado
- Monitorear consumer groups (`analytics-service`, `alerts-service`, `notification-service`) y su lag
- Inspeccionar particiones y offsets

---

### MQTT — ver datos del broker en tiempo real

Escuchar todos los mensajes de dispositivos via CLI (sin instalar nada):
```bash
docker exec -it iot-mosquitto mosquitto_sub -t "iot/devices/#" -v
```

Escuchar un dispositivo específico (usa el UUID real del dispositivo):
```bash
docker exec -it iot-mosquitto mosquitto_sub -t "iot/devices/<DEVICE_UUID>/data" -v
```

Salida de ejemplo:
```
iot/devices/a1b2c3d4-e5f6-7890-abcd-ef1234567890/data {"deviceId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","temperature":28.4,"humidity":61.2,"pressure":1013.5,...}
```

Alternativa con GUI: descarga **MQTT Explorer** (mqtt-explorer.com), conecta a `mqtt://localhost:1883`.

---

### Analytics — consultar métricas desde Redis

Primero obtén el UUID del dispositivo (listado en Adminer o via API):
```bash
# Obtener lista de dispositivos
curl http://localhost:3001/api/v1/devices

# Consultar métricas agregadas (avg/min/max por campo)
curl http://localhost:3002/api/v1/analytics/devices/{DEVICE_UUID}/metrics

# Consultar lecturas históricas (paginado)
curl "http://localhost:3002/api/v1/analytics/devices/{DEVICE_UUID}/readings?page=1&limit=20"
```

Respuesta de métricas de ejemplo:
```json
{
  "temperature": { "value": 29.1, "min": 15.2, "max": 44.8, "avg": 27.3, "count": 142 },
  "humidity":    { "value": 63.0, "min": 21.5, "max": 89.7, "avg": 55.1, "count": 142 },
  "pressure":    { "value": 1012.3, "min": 991.0, "max": 1029.5, "avg": 1010.8, "count": 142 }
}
```

---

### Base de datos — Adminer

Abre **http://localhost:8080** con:
- **System:** PostgreSQL
- **Server:** `postgres`
- **Username:** `iot_user`
- **Password:** `iot_password`
- **Database:** `iot_monitoring`

> Si tienes PostgreSQL instalado localmente, el contenedor Docker usa el puerto **5433** para evitar conflictos.
> Conexión local: `localhost:5433`

Tablas disponibles:
- `devices` — dispositivos registrados
- `device_readings` — lecturas de sensores con timestamp
- `alert_rules` — reglas de alertas configuradas
- `alerts` — alertas disparadas

---

### Redis — inspeccionar caché de métricas

Conectarse al Redis del contenedor:
```bash
docker exec -it iot-redis redis-cli
```

Consultar métricas cacheadas de un dispositivo:
```bash
# Ver todas las métricas de un dispositivo
HGETALL metrics:{DEVICE_UUID}

# Ver claves activas
KEYS metrics:*
```

---

### Flujo completo de datos (end-to-end)

```bash
# 1. Inicia el simulador
node scripts/mqtt-simulator.js 3 2000

# 2. Verifica en Kafka UI (http://localhost:8081)
#    → Tópico device.readings recibe mensajes

# 3. Verifica en Adminer (http://localhost:8080)
#    → Tabla device_readings crece con nuevas lecturas

# 4. Consulta métricas en Analytics (puerto 3002)
curl http://localhost:3002/api/v1/analytics/devices/{UUID}/metrics

# 5. Crea una regla de alerta
curl -X POST http://localhost:3003/api/v1/rules \
  -H "Content-Type: application/json" \
  -d '{"name":"Temp Alta","metricField":"temperature","condition":"GREATER_THAN","threshold":35,"severity":"HIGH"}'

# 6. Cuando se dispare, verifica en Kafka UI
#    → Tópico alert.triggered recibe el evento
```

### Resumen operativo y reglas por zona

El resumen identifica el sensor y la zona de temperatura/humedad, conserva el total de dispositivos y distingue los que enviaron señal en los últimos diez minutos. Incluye una lista de sensores sin señal reciente y los totales de alertas pendientes críticas, altas, medias y bajas.

Las reglas permiten elegir una zona y varios dispositivos, comparar mayor/menor/igual o definir un rango interior/exterior, y personalizar mensaje y color. Las alertas conservan estos detalles para su revisión histórica. Consulta [el flujo y la migración aditiva](docs/FRONTEND.md#reglas-por-zona-y-observabilidad) y [los campos de la API](docs/API.md#reglas-por-zona-rangos-y-resumen-de-alertas-featuredemo-auth-sessions).

Las alarmas muestran nombre, sensor y explicación separados, con mensajes automáticos en español y unidades legibles, también al consultar el formato histórico anterior.

El recorrido demuestra ahora temperatura, humedad y presión con tres reglas y tres alertas. Puedes enviar cada métrica manualmente o simular las tres juntas; el resumen incluye las tres mediciones con su unidad y origen.
