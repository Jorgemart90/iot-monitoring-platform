# IoT Monitoring Platform

A production-ready IoT monitoring platform built with NestJS microservices, demonstrating real-time data processing, event-driven architecture, and modern backend patterns.

## Tech Stack

- **Framework**: NestJS (monorepo)
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
| api-gateway | 3000 | JWT auth, Swagger docs, routing |
| device-service | 3001 | CRUD devices, MQTT consumer, Kafka producer |
| analytics-service | 3002 | Kafka consumer, Strategy Pattern metrics, Redis cache |
| alerts-service | 3003 | Rule evaluation, Kafka consumer+producer |
| notification-service | 3004 | SSE streaming, Redis Pub/Sub |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- npm 9+

### 1. Clone and setup
```bash
git clone <repo-url>
cd iot-monitoring-platform
cp .env.example .env
```

### 2. Start infrastructure
```bash
docker compose up -d postgres redis kafka mosquitto zookeeper
```

### 3. Install dependencies
```bash
npm install
```

### 4. Run a service locally (development)
```bash
npm run start:api-gateway
# In another terminal:
npm run start:device-service
```

### 5. Or run everything with Docker
```bash
docker compose up --build
```

### 6. Run the IoT simulator
```bash
node scripts/mqtt-simulator.js 3 2000
# Simulates 3 devices publishing every 2 seconds
```

## API Endpoints

### Auth (API Gateway :3000)
- `POST /api/v1/auth/login` — Get JWT token (user: admin, pass: admin123)
- `GET /api/v1/health` — Health check

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
3. Ejecuta con:
   ```json
   { "username": "admin", "password": "admin123" }
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

El simulador registra automáticamente los dispositivos faltantes via API antes de publicar por MQTT.

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
