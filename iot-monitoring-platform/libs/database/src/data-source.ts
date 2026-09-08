import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Device } from './entities/device.entity';
import { DeviceReading } from './entities/device-reading.entity';
import { AlertRule } from './entities/alert-rule.entity';
import { Alert } from './entities/alert.entity';
import { User } from './entities/user.entity';
import { migrations } from './migrations';

/**
 * DataSource exclusivo para el CLI de TypeORM (`npm run migration:*`).
 * Los servicios en ejecución NO usan este archivo: configuran TypeORM en DatabaseModule.
 *
 * Por qué variables propias DB_HOST_CLI / DB_PORT_CLI:
 * el CLI se ejecuta desde la máquina del desarrollador, donde `DB_HOST=postgres`
 * (nombre del contenedor) no resuelve. El CLI entra por el puerto publicado del
 * contenedor — 5433 — mientras los servicios se hablan por la red interna de Docker.
 * Las credenciales y el nombre de la base sí se comparten con el resto del .env.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST_CLI ?? 'localhost',
  port: parseInt(process.env.DB_PORT_CLI ?? '5433', 10),
  username: process.env.DB_USERNAME ?? 'iot_user',
  password: process.env.DB_PASSWORD ?? 'iot_password',
  database: process.env.DB_DATABASE ?? 'iot_monitoring',
  entities: [Device, DeviceReading, AlertRule, Alert, User],
  migrations,
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: ['error', 'migration', 'schema'],
});

export default AppDataSource;
