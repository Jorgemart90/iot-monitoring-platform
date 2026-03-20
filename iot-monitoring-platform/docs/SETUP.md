# Setup Guide

## Prerequisites

- Node.js 18+
- npm 9+
- Docker 24+
- Docker Compose v2

## Local Development

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env for local development:
# DB_HOST=localhost
# REDIS_HOST=localhost
# KAFKA_BROKER=localhost:9093  (external port)
# MQTT_BROKER=mqtt://localhost:1883
```

### 3. Start infrastructure only
```bash
docker compose up -d postgres redis kafka zookeeper mosquitto adminer
```

### 4. Run services individually
```bash
# Terminal 1
npm run start:api-gateway

# Terminal 2
npm run start:device-service

# Terminal 3
npm run start:analytics-service

# Terminal 4
npm run start:alerts-service

# Terminal 5
npm run start:notification-service
```

### 5. Test with simulator
```bash
node scripts/mqtt-simulator.js 3 2000
```

## Full Docker Deployment

```bash
# Build and start everything
docker compose up --build

# Check logs
docker compose logs -f api-gateway
docker compose logs -f device-service

# Stop all
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Useful URLs

| Service | URL |
|---------|-----|
| **Swagger UI (todos los servicios)** | **http://localhost:3000/api/docs** |
| Adminer (DB UI) | http://localhost:8080 |
| Kafka UI | http://localhost:8081 |
| MQTT Broker | mqtt://localhost:1883 |
| Kafka | localhost:9093 |

## Testing

```bash
# Run all tests
npm test

# With coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## Troubleshooting

### Kafka not ready
Wait ~30s after `docker compose up`. Kafka takes time to initialize.

### Port conflicts
Edit `docker-compose.yml` port mappings or `.env` port values.

### MQTT messages not processing
Ensure Mosquitto is running: `docker compose ps mosquitto`
Check Device Service logs: `docker compose logs device-service`
