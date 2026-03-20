# Architecture Overview

## System Design

The platform follows a microservices event-driven architecture. Each service owns its domain and communicates asynchronously via Kafka.

## Data Flow

```
1. IoT Simulator / Real Devices
   └─► MQTT Broker (Mosquitto :1883)
         └─► Device Service (subscribes to iot/devices/+/data)
               ├─► PostgreSQL (persists DeviceReading)
               └─► Kafka (publishes to device.readings)
                     ├─► Analytics Service (consumes device.readings)
                     │     ├─► Redis (caches aggregated metrics with Strategy Pattern)
                     │     └─► PostgreSQL (reads history)
                     └─► Alerts Service (consumes device.readings)
                           ├─► PostgreSQL (persists AlertRule, Alert)
                           └─► Kafka (publishes to alert.triggered)
                                 └─► Notification Service (consumes alert.triggered)
                                       ├─► Redis Pub/Sub (channel: notifications)
                                       └─► SSE Clients (GET /notifications/stream)
```

## Design Patterns Used

### Strategy Pattern (Analytics Service)
Each sensor metric (temperature, humidity, pressure) has a dedicated strategy class implementing `IMetricsStrategy`. The `MetricsProcessor` selects the appropriate strategy based on the field name, enabling easy addition of new metric types without modifying existing code.

### Repository Pattern (All Services)
TypeORM repositories abstract database access. Services inject repositories via the NestJS DI container.

### Transaction Pattern (Device Service)
Device creation uses a TypeORM `QueryRunner` to wrap the operation in a database transaction, ensuring atomicity.

### Pub/Sub Pattern (Notification Service)
Redis Pub/Sub decouples the Kafka consumer from SSE clients. The consumer publishes to a Redis channel; the notification service subscribes and fans out to active SSE connections.

## Shared Libraries

### @app/common
- `KAFKA_TOPICS`, `MQTT_TOPICS`, `REDIS_KEYS` constants
- `PaginationDto` with class-validator
- `AllExceptionsFilter` global HTTP exception handler
- `LoggingInterceptor` request/response logger
- `ApiPaginatedResponse` Swagger decorator

### @app/database
- `Device`, `DeviceReading`, `AlertRule`, `Alert` TypeORM entities
- `DatabaseModule` with async TypeORM configuration

## Infrastructure

| Component | Purpose | Image |
|-----------|---------|-------|
| PostgreSQL | Relational DB | postgres:15-alpine |
| Redis | Cache + Pub/Sub | redis:7-alpine |
| Kafka | Message streaming | confluentinc/cp-kafka:7.5.0 |
| Zookeeper | Kafka coordination | confluentinc/cp-zookeeper:7.5.0 |
| Mosquitto | MQTT broker | eclipse-mosquitto:2.0 |
| Adminer | DB admin UI | adminer:latest |
