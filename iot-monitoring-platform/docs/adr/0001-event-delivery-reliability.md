# ADR-0001: Reliable Event Delivery from Device Service

- **Status:** Proposed
- **Date:** 2026-11-12
- **Decision owners:** Project maintainer
- **Scope:** Device readings published from the Device Service to Kafka, and Kafka consumer failure handling

## Context

The current device-reading flow is:

`MQTT → Device Service → PostgreSQL → Kafka (device.readings) → Analytics / Alerts`

The reviewed implementation shows two reliability concerns:

1. **Database/Kafka dual write.** `MqttService` calls `DevicesService.saveReading()` and then `KafkaService.publishReading()`. The database transaction inside `saveReading()` persists the `DeviceReading` and updates `Device.lastSeenAt`, but Kafka publication happens after that transaction has completed. If the database write succeeds and the Kafka send fails, the reading exists in PostgreSQL but downstream consumers may never receive its event.
2. **Consumer errors are swallowed.** The reviewed Kafka `eachMessage` handlers in Analytics, Alerts, and Notifications catch errors and log them without rethrowing or applying an explicit retry/DLQ policy. KafkaJS documents that `eachMessage` automatically commits offsets after successful handler processing. Catching an error and returning normally makes the handler appear successful to the consumer, so a failed business operation can be skipped rather than retried.

The current producer uses `deviceId` as the Kafka message key, which is useful for keeping events for the same device in the same partition under the configured partitioner.

## Evidence reviewed

- `apps/device-service/src/mqtt/mqtt.service.ts`: saves a reading, then publishes it to Kafka.
- `apps/device-service/src/devices/devices.service.ts`: `saveReading()` uses a TypeORM transaction for the reading and `lastSeenAt` update.
- `apps/device-service/src/kafka/kafka.service.ts`: publishes to `device.readings`, keyed by `reading.deviceId`.
- `apps/analytics-service/src/kafka/kafka.service.ts`: catches and logs message-processing errors.
- `apps/alerts-service/src/kafka/kafka.service.ts`: catches and logs message-processing errors.
- `apps/notification-service/src/kafka/kafka.service.ts`: catches and logs message-processing errors.
- `docs/ARCHITECTURE.md`: describes the event-driven service flow.

No Outbox implementation was found in the reviewed paths and repository code searches. This is a scoped finding, not a claim that every possible branch or unindexed file has been exhaustively inspected.

## Decision proposed

Introduce a **Transactional Outbox** for device-reading events.

Within one PostgreSQL transaction, the Device Service should:

1. Persist the `DeviceReading`.
2. Update `Device.lastSeenAt`.
3. Insert an Outbox record containing a stable `eventId`, event type, aggregate/device ID, payload, creation timestamp, and publication state.

A separate publisher should read pending Outbox records, publish them to Kafka, and mark them as published only after Kafka acknowledges the send.

The event publisher should retain `deviceId` as the Kafka message key to preserve per-device partition ordering. Include the stable `eventId` in the event payload or headers so consumers can implement idempotency.

### Delivery semantics

The Outbox relay provides **at-least-once delivery**, not end-to-end exactly-once processing. If Kafka accepts an event but the relay fails before marking the Outbox row as published, the event can be sent again. Consumers must therefore make their business effects idempotent, for example by recording processed event IDs under a unique constraint.

### Consumer failure policy

Replace catch-and-log-only behavior with an explicit policy:

- For transient failures, use bounded retries with backoff or pause the affected partition according to the failure type.
- For messages that exceed the retry policy or cannot be processed, route them to a dead-letter topic with enough metadata to diagnose and replay them.
- Do not acknowledge/commit a message as successfully processed when its business operation failed.
- Make handlers idempotent because retries and re-delivery are expected in an at-least-once system.

The exact retry, offset-commit, and DLQ design should be selected and tested per consumer before implementation. Avoid an unbounded retry loop that blocks a partition indefinitely.

## Alternatives considered

### Keep direct database write followed by Kafka publish

- **Pros:** minimal code and operational overhead.
- **Cons:** leaves a failure window between the database commit and Kafka publication.
- **Reason not selected:** does not close the identified dual-write gap.

### Publish first, then persist the reading

- **Pros:** downstream consumers can receive the event before the database write.
- **Cons:** a database failure can leave consumers processing a reading that is not persisted; reversing the order only moves the inconsistency window.
- **Reason not selected:** does not provide atomicity across the database and broker.

### Use a distributed transaction across PostgreSQL and Kafka

- **Pros:** can coordinate multiple transactional resources in systems that support compatible transaction semantics.
- **Cons:** increases coupling and operational complexity; the current implementation does not establish such a transaction.
- **Reason not selected:** the Outbox pattern is a simpler fit for this service boundary.

## Consequences and trade-offs

**Benefits**
- The reading and the intent to publish its event are committed atomically in PostgreSQL.
- Temporary Kafka outages do not require losing the event.
- Publication can be retried independently from MQTT ingestion.
- Stable event IDs enable consumer deduplication and safer replay.

**Costs**
- Adds an Outbox table, relay process, migrations, cleanup, and monitoring.
- Delivery is at least once, so consumers need idempotency.
- The relay introduces a small publication delay and needs throughput/back-pressure controls.
- DLQ messages require an operational replay and retention policy.

## Implementation plan

1. Add a migration for the Outbox table and indexes for pending-event polling.
2. Extend the reading transaction to insert the Outbox event atomically with the reading.
3. Implement a relay with bounded batch size, retry/backoff, safe concurrent claiming, and graceful shutdown.
4. Publish the stable event ID and preserve the existing topic and device key.
5. Add idempotency to Analytics and Alerts consumers before enabling retries.
6. Define explicit retry and DLQ behavior for Analytics, Alerts, and Notifications.
7. Add metrics and structured logs for pending count, oldest pending age, publish failures, retry count, DLQ count, event ID, device ID, topic, partition, and offset. Mask secrets and personal data.
8. Roll out behind a controlled configuration/feature flag, compare event counts and processing outcomes, then remove the direct publish path once the relay is verified.

## Acceptance criteria

- A failed Kafka send leaves the Outbox record pending and does not lose the persisted reading event.
- A restarted relay resumes pending publication.
- Duplicate publication does not duplicate business effects in consumers.
- Transient consumer failures are retried according to a bounded policy.
- Poison messages are visible in a DLQ and do not silently disappear.
- Logs and metrics make pending events, retries, and failures observable.
- Existing API and event contracts remain compatible during rollout.

## References

- [Device MQTT handler](../../apps/device-service/src/mqtt/mqtt.service.ts)
- [Device persistence service](../../apps/device-service/src/devices/devices.service.ts)
- [Device Kafka producer](../../apps/device-service/src/kafka/kafka.service.ts)
- [Analytics Kafka consumer](../../apps/analytics-service/src/kafka/kafka.service.ts)
- [Alerts Kafka consumer](../../apps/alerts-service/src/kafka/kafka.service.ts)
- [Notifications Kafka consumer](../../apps/notification-service/src/kafka/kafka.service.ts)
- [KafkaJS consuming messages and offset commits](https://kafka.js.org/docs/consuming)
