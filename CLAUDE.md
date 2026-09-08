# CLAUDE.md — Portfolio de Jorge Martinez

Contexto para Claude Code al trabajar en este repositorio.

## Propósito del repositorio

Este repo es el **portafolio profesional** de Jorge Martinez. No es un experimento ni un
tutorial: su función es **demostrar experiencia real en desarrollo backend** ante reclutadores
y equipos técnicos. Cada decisión de arquitectura debe poder defenderse en una entrevista.

Implicaciones prácticas:

- El código debe verse **production-grade**: manejo de errores, validación, tests, logs, Docker, CI.
- Los patrones deben ser **visibles y bien nombrados** (Strategy, Repository, Pub/Sub, Transaction).
- Preferir soluciones que muestren criterio de ingeniería sobre atajos que "solo funcionan".
- La documentación es parte del entregable, no un extra.

## Objetivo actual

**Terminar el proyecto de portafolio y prepararlo para despliegue en producción.**

Opciones de hosting en evaluación (aún sin decidir):

| Opción | Notas |
|---|---|
| AWS EC2 + Docker Compose | Máximo control, `docker-compose.yml` actual reutilizable casi tal cual |
| AWS App Runner | Menos ops, pero un servicio por imagen; Kafka/MQTT necesitan gestión aparte (MSK / broker externo) |
| Fly.io | Buen fit para varios contenedores pequeños + Postgres/Redis gestionados |
| Railway | El más rápido de poner en pie; Kafka es el punto débil |

El cuello de botella en cualquier opción es la **infraestructura de mensajería**
(Kafka + Zookeeper + Mosquitto), no los servicios NestJS.

## Preferencias de trabajo (obligatorias)

1. **Explicar los cambios antes de aplicarlos.** Describir qué se va a tocar y por qué, luego ejecutar.
2. **Todo debe quedar documentado.** Ningún cambio sin su rastro escrito.
3. **Si un cambio es relevante para quien usa el proyecto → actualizar `README.md`.**
4. **Si un cambio modifica una entrada o salida de API → documentar la actualización**
   (decoradores Swagger en el controlador + `docs/API.md` + `README.md` si el flujo de uso cambia).
5. Explicaciones y comentarios en **español**; código, nombres de variables y commits en inglés.

---

# Proyecto: IoT Monitoring Platform

Ubicación: `iot-monitoring-platform/`

Plataforma de monitoreo IoT en tiempo real: monorepo NestJS con 5 microservicios, frontend
React, ingesta MQTT, bus de eventos Kafka, caché Redis y streaming SSE al navegador.

## Stack

- **Backend**: NestJS 10 (monorepo), TypeScript 5, Node 20
- **Base de datos**: PostgreSQL 15 + TypeORM 0.3
- **Broker de eventos**: Apache Kafka 7.5 (kafkajs) + Zookeeper
- **Protocolo IoT**: MQTT / Eclipse Mosquitto 2.0
- **Caché y Pub/Sub**: Redis 7 (ioredis)
- **Auth**: JWT (Passport) + bcrypt + verificación por email (nodemailer/SMTP)
- **Tiempo real**: Server-Sent Events
- **Frontend**: React 18 + Vite 6 + TailwindCSS + shadcn/ui (Radix) + Recharts + React Router
- **Docs**: Swagger/OpenAPI unificado en el gateway
- **Infra**: Docker + Docker Compose, GitHub Actions

## Arquitectura

```
Dispositivos IoT
      │ MQTT (iot/devices/+/data)
      ▼
device-service ──► Kafka: device.readings ──┬──► analytics-service ──► Redis (métricas agregadas)
                                            │
                                            └──► alerts-service (evalúa reglas)
                                                      │ Kafka: alert.triggered
                                                      ▼
                                            notification-service ──► Redis Pub/Sub ──► SSE ──► Frontend
```

### Servicios

| Servicio | Puerto | Responsabilidad |
|---|---|---|
| `api-gateway` | 3000 | Auth (registro, verificación email, login, bootstrap admin), health, Swagger unificado |
| `device-service` | 3001 | CRUD de dispositivos, suscriptor MQTT, productor Kafka |
| `analytics-service` | 3002 | Consumidor Kafka, agregación de métricas (Strategy), caché Redis, lecturas históricas |
| `alerts-service` | 3003 | CRUD de reglas, evaluación de lecturas, generación de alertas, productor Kafka |
| `notification-service` | 3004 | Consumidor Kafka, Redis Pub/Sub, stream SSE a clientes |
| `frontend` | 5173 (dev) / 3005 (Docker→Nginx) | Dashboard React |

### Librerías compartidas

- **`@app/common`** → `libs/common/src`
  `constants/` (KAFKA_TOPICS, MQTT_TOPICS, REDIS_KEYS), `dto/PaginationDto`,
  `guards/` (JwtAuthGuard, RolesGuard), `decorators/` (`@Roles`, `@ApiPaginatedResponse`),
  `filters/AllExceptionsFilter`, `interceptors/LoggingInterceptor`, `interfaces/IDeviceReading`.
- **`@app/database`** → `libs/database/src`
  `DatabaseModule` (TypeORM async) y entidades: `User`, `Device`, `DeviceReading`,
  `AlertRule`, `Alert`.

Los alias `@app/common` y `@app/database` están definidos en `tsconfig.json` (`paths`) y
en el `moduleNameMapper` de Jest en `package.json`. **Al añadir un lib nuevo hay que
registrarlo en los tres sitios**: `tsconfig.json`, `nest-cli.json` y `moduleNameMapper`.

### Patrones implementados (destacables en entrevista)

- **Strategy** — `analytics-service/src/analytics/strategies/`: una estrategia por métrica
  (temperature, humidity, pressure) resuelta por `MetricsProcessor`. Añadir una métrica = añadir una clase.
- **Repository** — repositorios TypeORM inyectados por DI en todos los servicios.
- **Transaction** — creación de dispositivos vía `QueryRunner` en `devices.service.ts`.
- **Pub/Sub** — `notification-service` publica en el canal Redis `notifications`; el `SseService` hace fan-out a los clientes conectados.
- **Guard + Decorator** — `RolesGuard` + `@Roles(UserRole.ADMIN)` para autorización por rol.

## Autenticación y autorización (estado actual)

Flujo real implementado en `api-gateway/src/auth`:

1. `POST /api/v1/auth/setup-admin` — bootstrap. Crea el **primer** admin ya verificado.
   Se autodesactiva (403) en cuanto existe al menos un usuario.
2. `POST /api/v1/auth/register` — crea usuario con rol `viewer`, `isVerified: false`,
   y envía email con token (`crypto.randomBytes(32)`, expira en 24 h) vía SMTP.
3. `GET /api/v1/auth/verify-email?token=…` — marca el usuario como verificado.
4. `POST /api/v1/auth/login` — body `{ email, password }`. Rechaza usuarios no verificados.
   Devuelve `{ access_token, user: { id, email, name, role } }`.
   Payload JWT: `{ sub, email, role }`.

Roles: `admin` | `viewer` (`UserRole` en `libs/database/src/entities/user.entity.ts`).
Escrituras (crear/actualizar/borrar dispositivos, reglas) requieren `admin`; lecturas basta `viewer`.

Cada microservicio valida el JWT localmente con su propia `JwtStrategy`
(`apps/*/src/auth/jwt.strategy.ts`) usando el mismo `JWT_SECRET` — no hay llamada al gateway.

> ⚠️ El `README.md` y `docs/API.md` todavía describen el login antiguo (`admin`/`admin123`
> con `username`). **Están desactualizados respecto a este flujo.**

## Comandos

Todos desde `iot-monitoring-platform/`.

```bash
# Infraestructura (dejar corriendo)
docker compose up -d postgres redis kafka zookeeper mosquitto
docker compose up -d adminer kafka-ui        # UIs opcionales

# Backend en dev (un terminal por servicio)
npm run start:api-gateway
npm run start:device-service
npm run start:analytics-service
npm run start:alerts-service
npm run start:notification-service

# Frontend
cd apps/frontend && npm run dev              # http://localhost:5173 (proxy a los 5 servicios)

# Todo en Docker
docker compose up --build

# Tests
npm test                                     # Jest (backend, *.spec.ts en apps/ y libs/)
npm run test:cov
cd apps/frontend && npm test                 # Vitest

# Build y calidad
npm run build:all                            # compila los 5 servicios
npm run lint
npm run format

# Simulador de dispositivos IoT
node scripts/mqtt-simulator.js 3 2000        # 3 dispositivos, cada 2 s
```

### URLs útiles

| Recurso | URL |
|---|---|
| Swagger unificado (los 5 servicios) | http://localhost:3000/api/docs |
| Frontend (dev) | http://localhost:5173 |
| Frontend (Docker) | http://localhost:3005 |
| Kafka UI | http://localhost:8081 |
| Adminer | http://localhost:8080 |
| Postgres (host) | `localhost:5433` — el puerto 5433 evita choque con un Postgres local |

## Convenciones de código

- Estructura por feature: `apps/<servicio>/src/<feature>/{*.controller.ts, *.service.ts, *.module.ts, dto/}`.
- Tests en `apps/<servicio>/test/*.spec.ts` (fuera de `src/`), con `Test.createTestingModule` y repositorios mockeados.
- DTOs con `class-validator` + `@ApiProperty`. `ValidationPipe` global usa
  `whitelist: true, forbidNonWhitelisted: true` → **un campo no declarado en el DTO devuelve 400**.
- Prefijo global `api/v1` en todos los servicios; nada de rutas sin versionar.
- Paginación siempre con `PaginationDto` y respuesta `{ data, meta: { total, page, limit, totalPages } }`.
- Logging con el `Logger` de NestJS (`new Logger(ClaseName.name)`), nunca `console.log`.
- Errores con las excepciones HTTP de NestJS (`NotFoundException`, `ConflictException`, …);
  `AllExceptionsFilter` normaliza la respuesta.
- Constantes de topics/keys siempre desde `@app/common/constants` — nunca strings literales.
- Mensajes de error de cara al usuario en español; logs en inglés.
- TypeScript está en modo laxo (`strictNullChecks: false`, `noImplicitAny: false`).
  No endurecerlo sin avisar: rompería compilación en varios archivos.

## Swagger unificado — cómo funciona

`api-gateway/src/main.ts` construye su propio documento y, **en background cada 30 s**, hace
fetch a `/api/docs-json` de los otros 4 servicios y fusiona paths, schemas y tags
(`patchDocumentOnRequest` sirve la versión cacheada).

Cada path fusionado lleva `servers: [{ url }]` con la **URL pública** del servicio, para que
el navegador pegue al puerto correcto. De ahí el par de variables por servicio:

- `*_SERVICE_URL` — URL interna que usa Node para hacer el fetch (nombre de contenedor en Docker).
- `*_SERVICE_PUBLIC_URL` — URL que usa el navegador (localhost desde el host).

**Esto es clave para el despliegue**: en producción `*_SERVICE_PUBLIC_URL` debe apuntar al
dominio público, no a localhost, o el Swagger quedará inservible.

## Variables de entorno

`.env` en la raíz de `iot-monitoring-platform/` (plantilla en `.env.example`).

`DB_HOST` `DB_PORT` `DB_USERNAME` `DB_PASSWORD` `DB_DATABASE` · `REDIS_HOST` `REDIS_PORT` ·
`KAFKA_BROKER` · `MQTT_BROKER` · `JWT_SECRET` `JWT_EXPIRATION` ·
`SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` · `APP_URL` (base para el link de verificación) ·
`API_GATEWAY_PORT` `DEVICE_SERVICE_PORT` `ANALYTICS_SERVICE_PORT` `ALERTS_SERVICE_PORT` `NOTIFICATION_SERVICE_PORT` ·
`NODE_ENV`

`.env.example` está **incompleto**: le faltan `SMTP_*` y `APP_URL`. Corregirlo antes de publicar el repo.

## CI

`.github/workflows/ci.yml` (en la raíz del repo, no dentro del proyecto). Tres jobs en push/PR a `main`:

1. **backend** — `npm ci`, lint (`continue-on-error`), `npx jest --testPathPattern="test/"`, `npm run build:all`.
2. **frontend** — `npm ci`, `tsc --noEmit`, `vitest run`, `vite build`.
3. **docker** — depende de los dos anteriores; construye las 6 imágenes con caché de GHA (sin push).

Al añadir un servicio nuevo hay que añadir su paso de build de imagen aquí.

## Pendientes conocidos hacia producción

Lista viva — actualizar a medida que se resuelvan:

- [ ] **Migraciones TypeORM.** `DatabaseModule` usa `synchronize: NODE_ENV === 'development'`,
      así que en producción **no se crea ni actualiza el esquema**. Bloqueante para el despliegue.
- [ ] **Decidir hosting** entre AWS / Fly.io / Railway, y resolver Kafka gestionado vs. autogestionado.
- [ ] **`README.md` y `docs/API.md` desactualizados**: documentan el login viejo
      (`username`/`admin123`) y omiten registro, verificación de email, `setup-admin`,
      roles, la tabla `users` y el frontend.
- [ ] **`.env.example` incompleto** (`SMTP_*`, `APP_URL`).
- [ ] `JWT_SECRET` de ejemplo en `.env.example` — asegurar secretos reales por entorno.
- [ ] Sin healthchecks HTTP en los servicios de aplicación del `docker-compose.yml`
      (solo los tienen postgres/redis/kafka).
- [ ] Sin observabilidad más allá de logs (métricas/tracing pendientes).

## Estructura del repo

```
portfolio/
├── CLAUDE.md                  ← este archivo
├── .github/workflows/ci.yml
└── iot-monitoring-platform/
    ├── apps/
    │   ├── api-gateway/       (auth, mail, health, swagger merge)
    │   ├── device-service/    (devices, mqtt, kafka)
    │   ├── analytics-service/ (analytics + strategies, kafka, redis)
    │   ├── alerts-service/    (alerts, rules, kafka)
    │   ├── notification-service/ (notifications, sse, redis, kafka)
    │   └── frontend/          (React + Vite + shadcn/ui)
    ├── libs/
    │   ├── common/            → @app/common
    │   └── database/          → @app/database
    ├── config/mosquitto.conf
    ├── scripts/               (init-db.sql, mqtt-simulator.js)
    ├── docs/                  (API.md, ARCHITECTURE.md, SETUP.md)
    ├── docker-compose.yml
    ├── nest-cli.json
    └── tsconfig.json
```
