# Local Docker verification

Run these commands from this branch's `iot-monitoring-platform` directory. The checkout used for verification is `C:\Users\jorge\Documents\portfolio-demo-auth\iot-monitoring-platform`.

```powershell
# Only for a new checkout without .env:
Copy-Item .env.example .env

docker compose -p iot-demo-auth up -d --build
docker compose -p iot-demo-auth ps -a
```

Wait for all five application services to finish starting. Infrastructure health does not mean the HTTP applications are ready yet. The applications retry up to three times if a transient startup failure occurs (for example while Kafka creates its topics).

Swagger: http://localhost:3000/api/docs
Kafka UI: http://localhost:8081
Adminer: http://localhost:8080

MASTER credentials come from this checkout's `.env`. The initial verification used `.env.example` defaults and a new `iot-demo-auth` database volume. The original checkout's `.env` was not copied or modified. Compose uses fixed container names and host ports, so another instance of this stack cannot run alongside it unchanged.

## End-to-end checks

```powershell
docker cp scripts/demo-e2e.cjs iot-api-gateway:/usr/src/app/demo-e2e.cjs
docker exec iot-api-gateway node demo-e2e.cjs
```

The test creates two temporary DEMO users, three devices and three rules. It checks MASTER login, invalid credentials, role authorization, ownership, quotas, MQTT ingestion, stored readings, metrics, alert acknowledgement/resolution, SSE delivery to owner and MASTER, isolation from the other DEMO user, refresh rotation, logout and session revocation. Demo data remains available for inspection until automatic expiration cleanup. Repeated runs count toward the limit of ten demo sessions per hour per client IP.

## Session persistence across restart

```powershell
docker cp scripts/session-restart-check.cjs iot-api-gateway:/usr/src/app/session-restart-check.cjs
docker exec iot-api-gateway node session-restart-check.cjs prepare
docker restart iot-api-gateway
# Wait until the gateway is responding again.
docker exec iot-api-gateway node session-restart-check.cjs verify
```

The check temporarily stores its own token/cookie inside the container with mode 0600 and deletes the file after successful verification. It verifies that the access token, session listing and refresh still work after restart, then revokes its session.

## Existing unit tests

```powershell
docker build --target development -f apps/api-gateway/Dockerfile -t iot-demo-auth-tests .
docker run --rm iot-demo-auth-tests npm test -- --runInBand
```

Verified on 2026-09-07: all five services compiled; 46 HTTP checks plus SSE assertions passed; the restart check passed; all 20 unit tests in four suites passed.

These checks cover the sequential local demo flow. They do not validate concurrent refresh requests, expiration timing, or revocation of an already-open SSE connection.

Stop the stack while keeping its data:

```powershell
docker compose -p iot-demo-auth stop
```
