import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esquema inicial de la plataforma: users, devices, device_readings, alert_rules, alerts.
 *
 * Se escribe con `IF NOT EXISTS` a propósito. Hasta esta migración el esquema se creaba
 * con `synchronize: true`, así que existen bases de datos de desarrollo que ya tienen las
 * tablas. Esto permite adoptar migraciones sin recrear esas bases: la migración se marca
 * como aplicada y a partir de aquí todo cambio pasa por una migración nueva.
 *
 * Los nombres de los tipos enum replican la convención de TypeORM (`<tabla>_<columna>_enum`)
 * para que un futuro `migration:generate` no detecte diferencias inexistentes.
 */
export class InitialSchema1787270400000 implements MigrationInterface {
  name = 'InitialSchema1787270400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid_generate_v4() — también lo crea scripts/init-db.sql, pero una base creada
    // fuera de Docker (o un Postgres gestionado) no pasa por ese script.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── Tipos enum ────────────────────────────────────────────────────────────
    // CREATE TYPE no admite IF NOT EXISTS en Postgres 15; se captura duplicate_object.
    const createEnum = (name: string, values: string[]) => `
      DO $$ BEGIN
        CREATE TYPE "${name}" AS ENUM (${values.map((v) => `'${v}'`).join(', ')});
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;

    await queryRunner.query(createEnum('users_role_enum', ['admin', 'viewer']));
    await queryRunner.query(
      createEnum('devices_type_enum', [
        'TEMPERATURE_SENSOR',
        'HUMIDITY_SENSOR',
        'MULTI_SENSOR',
      ]),
    );
    await queryRunner.query(
      createEnum('devices_status_enum', ['ACTIVE', 'INACTIVE', 'MAINTENANCE']),
    );
    await queryRunner.query(
      createEnum('alert_rules_condition_enum', [
        'GREATER_THAN',
        'LESS_THAN',
        'EQUALS',
        'BETWEEN',
      ]),
    );
    await queryRunner.query(
      createEnum('alert_rules_severity_enum', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    );
    await queryRunner.query(
      createEnum('alerts_severity_enum', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    );
    await queryRunner.query(
      createEnum('alerts_status_enum', ['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED']),
    );

    // ── users ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"                        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email"                     character varying(255) NOT NULL,
        "name"                      character varying(255) NOT NULL,
        "password_hash"             character varying NOT NULL,
        "role"                      "users_role_enum" NOT NULL DEFAULT 'viewer',
        "is_verified"               boolean NOT NULL DEFAULT false,
        "verification_token"        character varying,
        "verification_token_expiry" TIMESTAMP,
        "created_at"                TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"                TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    // ── devices ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "devices" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name"       character varying(255) NOT NULL,
        "type"       "devices_type_enum" NOT NULL DEFAULT 'MULTI_SENSOR',
        "status"     "devices_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "location"   character varying,
        "metadata"   jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_devices_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_devices_name" UNIQUE ("name")
      )
    `);

    // ── device_readings ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "device_readings" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "device_id"   uuid NOT NULL,
        "temperature" numeric(5,2),
        "humidity"    numeric(5,2),
        "pressure"    numeric(7,2),
        "timestamp"   TIMESTAMP NOT NULL,
        "metadata"    jsonb,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_readings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_device_readings_device_timestamp"
        ON "device_readings" ("device_id", "timestamp")
    `);

    // ── alert_rules ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alert_rules" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name"          character varying(255) NOT NULL,
        "description"   text,
        "device_id"     uuid,
        "metric_field"  character varying(100) NOT NULL,
        "condition"     "alert_rules_condition_enum" NOT NULL,
        "threshold"     numeric(10,2) NOT NULL,
        "threshold_max" numeric(10,2),
        "severity"      "alert_rules_severity_enum" NOT NULL DEFAULT 'MEDIUM',
        "is_active"     boolean NOT NULL DEFAULT true,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_alert_rules_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_alert_rules_name" UNIQUE ("name")
      )
    `);

    // ── alerts ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alerts" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rule_id"         uuid NOT NULL,
        "device_id"       uuid NOT NULL,
        "message"         text NOT NULL,
        "severity"        "alerts_severity_enum" NOT NULL,
        "status"          "alerts_status_enum" NOT NULL DEFAULT 'TRIGGERED',
        "triggered_value" numeric(10,2) NOT NULL,
        "metadata"        jsonb,
        "triggered_at"    TIMESTAMP NOT NULL DEFAULT now(),
        "acknowledged_at" TIMESTAMP,
        "resolved_at"     TIMESTAMP,
        CONSTRAINT "PK_alerts_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_alerts_status" ON "alerts" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_alerts_triggered_at" ON "alerts" ("triggered_at")`,
    );

    // ── Claves foráneas ───────────────────────────────────────────────────────
    // ADD CONSTRAINT no admite IF NOT EXISTS; se captura duplicate_object igual que los enums.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "device_readings"
          ADD CONSTRAINT "FK_device_readings_device"
          FOREIGN KEY ("device_id") REFERENCES "devices"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "alerts"
          ADD CONSTRAINT "FK_alerts_rule"
          FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT IF EXISTS "FK_alerts_rule"`);
    await queryRunner.query(
      `ALTER TABLE "device_readings" DROP CONSTRAINT IF EXISTS "FK_device_readings_device"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "alerts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alert_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_readings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "devices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "alerts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "alerts_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "alert_rules_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "alert_rules_condition_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "devices_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "devices_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}
