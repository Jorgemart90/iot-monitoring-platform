import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Semilla de datos: usuario admin, usuario demo, 3 dispositivos y 3 reglas de alerta.
 *
 * Sin esta semilla el demo arranca vacío: sin admin no se puede administrar nada
 * (`/auth/setup-admin` exige que la base esté sin usuarios) y sin dispositivos ni reglas
 * no hay nada que mostrar al visitante.
 *
 * Las credenciales del admin salen del entorno. Los valores por defecto son los de
 * desarrollo, para que un `git clone` + `migration:run` funcione sin configurar nada.
 * EN PRODUCCIÓN hay que definir ADMIN_EMAIL y ADMIN_PASSWORD antes de migrar.
 *
 * UUIDs fijos: hacen la semilla idempotente (`ON CONFLICT DO NOTHING`) y permiten
 * referenciar los datos desde documentación y tests.
 */

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_ID = '00000000-0000-4000-8000-000000000002';

const DEVICE_IDS = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
];

const RULE_IDS = [
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
];

const BCRYPT_ROUNDS = 12;

export class SeedDemoData1787270500000 implements MigrationInterface {
  name = 'SeedDemoData1787270500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Usuarios ──────────────────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@iotmonitor.dev';
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'MariaP12@';
    const demoEmail = process.env.DEMO_EMAIL ?? 'demo@iotmonitor.dev';
    const demoPassword = process.env.DEMO_PASSWORD ?? 'Demo1234@';

    const [adminHash, demoHash] = await Promise.all([
      bcrypt.hash(adminPassword, BCRYPT_ROUNDS),
      bcrypt.hash(demoPassword, BCRYPT_ROUNDS),
    ]);

    // is_verified = true: son cuentas sembradas, no pasan por verificación de correo.
    await queryRunner.query(
      `INSERT INTO "users" ("id", "email", "name", "password_hash", "role", "is_verified")
       VALUES ($1, $2, $3, $4, 'admin', true)
       ON CONFLICT DO NOTHING`,
      [ADMIN_ID, adminEmail, 'Administrador', adminHash],
    );

    await queryRunner.query(
      `INSERT INTO "users" ("id", "email", "name", "password_hash", "role", "is_verified")
       VALUES ($1, $2, $3, $4, 'viewer', true)
       ON CONFLICT DO NOTHING`,
      [DEMO_ID, demoEmail, 'Usuario Demo', demoHash],
    );

    // ── Dispositivos ──────────────────────────────────────────────────────────
    const devices = [
      {
        id: DEVICE_IDS[0],
        name: 'Sensor Sala de Servidores',
        type: 'MULTI_SENSOR',
        location: 'Edificio A · Planta 1',
        metadata: { seed: true, firmware: '2.1.0', model: 'BME280' },
      },
      {
        id: DEVICE_IDS[1],
        name: 'Sensor Almacén Frío',
        type: 'TEMPERATURE_SENSOR',
        location: 'Edificio B · Cámara 3',
        metadata: { seed: true, firmware: '1.8.4', model: 'DS18B20' },
      },
      {
        id: DEVICE_IDS[2],
        name: 'Sensor Invernadero',
        type: 'HUMIDITY_SENSOR',
        location: 'Exterior · Zona norte',
        metadata: { seed: true, firmware: '1.8.4', model: 'DHT22' },
      },
    ];

    for (const device of devices) {
      await queryRunner.query(
        `INSERT INTO "devices" ("id", "name", "type", "status", "location", "metadata")
         VALUES ($1, $2, $3::"devices_type_enum", 'ACTIVE', $4, $5::jsonb)
         ON CONFLICT DO NOTHING`,
        [
          device.id,
          device.name,
          device.type,
          device.location,
          JSON.stringify(device.metadata),
        ],
      );
    }

    // ── Reglas de alerta ──────────────────────────────────────────────────────
    // Umbrales elegidos para que el simulador (temp 15-45, humedad 20-90) las dispare
    // con distinta frecuencia y el dashboard muestre las cuatro severidades.
    // device_id NULL = la regla aplica a todos los dispositivos.
    const rules = [
      {
        id: RULE_IDS[0],
        name: 'Temperatura alta',
        description: 'Avisa cuando la temperatura supera los 35 °C.',
        metricField: 'temperature',
        condition: 'GREATER_THAN',
        threshold: 35,
        thresholdMax: null,
        severity: 'HIGH',
      },
      {
        id: RULE_IDS[1],
        name: 'Temperatura crítica',
        description: 'Riesgo de daño al equipo por encima de 42 °C.',
        metricField: 'temperature',
        condition: 'GREATER_THAN',
        threshold: 42,
        thresholdMax: null,
        severity: 'CRITICAL',
      },
      {
        id: RULE_IDS[2],
        name: 'Humedad baja',
        description: 'Humedad relativa por debajo del 25 %.',
        metricField: 'humidity',
        condition: 'LESS_THAN',
        threshold: 25,
        thresholdMax: null,
        severity: 'MEDIUM',
      },
    ];

    for (const rule of rules) {
      await queryRunner.query(
        `INSERT INTO "alert_rules"
           ("id", "name", "description", "device_id", "metric_field",
            "condition", "threshold", "threshold_max", "severity", "is_active")
         VALUES ($1, $2, $3, NULL, $4,
                 $5::"alert_rules_condition_enum", $6, $7,
                 $8::"alert_rules_severity_enum", true)
         ON CONFLICT DO NOTHING`,
        [
          rule.id,
          rule.name,
          rule.description,
          rule.metricField,
          rule.condition,
          rule.threshold,
          rule.thresholdMax,
          rule.severity,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las alertas generadas cuelgan de las reglas por FK ON DELETE CASCADE,
    // y las lecturas de los dispositivos igual: basta borrar reglas y dispositivos.
    await queryRunner.query(`DELETE FROM "alert_rules" WHERE "id" = ANY($1::uuid[])`, [RULE_IDS]);
    await queryRunner.query(`DELETE FROM "devices" WHERE "id" = ANY($1::uuid[])`, [DEVICE_IDS]);
    await queryRunner.query(`DELETE FROM "users" WHERE "id" = ANY($1::uuid[])`, [
      [ADMIN_ID, DEMO_ID],
    ]);
  }
}
