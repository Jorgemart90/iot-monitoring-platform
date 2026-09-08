import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Device } from './entities/device.entity';
import { DeviceReading } from './entities/device-reading.entity';
import { AlertRule } from './entities/alert-rule.entity';
import { Alert } from './entities/alert.entity';
import { User } from './entities/user.entity';
import { migrations } from './migrations';

/**
 * Configuración de TypeORM compartida por todos los servicios.
 *
 * `synchronize` está desactivado en TODOS los entornos, también en desarrollo:
 * el esquema lo definen las migraciones y nada más. Un único comportamiento evita
 * la clase de fallo más típica al desplegar — que en local el esquema aparezca solo
 * y en producción no exista.
 *
 * `migrationsRun: true` aplica las migraciones pendientes al arrancar. Con varios
 * servicios levantando a la vez, el primero toma un lock de Postgres sobre la tabla
 * `migrations` y el resto espera; no se duplican.
 *
 * Al cambiar una entidad: `npm run migration:generate -- libs/database/src/migrations/NombreDelCambio`
 * y registrar la clase en `libs/database/src/migrations/index.ts`.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST'),
        port: parseInt(configService.get<string>('DB_PORT'), 10),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [Device, DeviceReading, AlertRule, Alert, User],
        migrations,
        migrationsTableName: 'migrations',
        migrationsRun: configService.get<string>('DB_MIGRATIONS_RUN', 'true') !== 'false',
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
