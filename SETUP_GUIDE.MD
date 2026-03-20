¡Perfecto! Aquí te dejo un archivo Markdown con todas las instrucciones paso a paso para crear el proyecto en VSCode:

````markdown name=SETUP_GUIDE.md
# 🚀 Guía de Implementación - IoT Monitoring Platform

Esta guía te ayudará a crear el proyecto completo paso a paso en VSCode.

## 📋 Tabla de Contenidos

1. [Preparación del Entorno](#1-preparación-del-entorno)
2. [Configuración Inicial del Proyecto](#2-configuración-inicial-del-proyecto)
3. [Configuración de Docker](#3-configuración-de-docker)
4. [Creación de Librerías Compartidas](#4-creación-de-librerías-compartidas)
5. [API Gateway](#5-api-gateway)
6. [Device Service](#6-device-service)
7. [Analytics Service](#7-analytics-service)
8. [Alerts Service](#8-alerts-service)
9. [Notification Service](#9-notification-service)
10. [Simulador IoT](#10-simulador-iot)
11. [Testing](#11-testing)
12. [Documentación](#12-documentación)

---

## 1. Preparación del Entorno

### Requisitos previos:
```bash
node --version  # v18+
npm --version   # v9+
docker --version
docker-compose --version
```

### Clonar el repositorio:
```bash
git clone https://github.com/Jorgemart90/iot-monitoring-platform.git
cd iot-monitoring-platform
```

---

## 2. Configuración Inicial del Proyecto

### 2.1 Inicializar proyecto NestJS monorepo

```bash
# Instalar Nest CLI globalmente
npm install -g @nestjs/cli

# Crear el proyecto base
nest new iot-monitoring-platform --skip-git
cd iot-monitoring-platform

# Instalar dependencias base
npm install --save @nestjs/config @nestjs/typeorm typeorm pg
npm install --save @nestjs/swagger swagger-ui-express
npm install --save @nestjs/microservices
npm install --save @nestjs/jwt @nestjs/passport passport passport-jwt
npm install --save kafkajs mqtt redis ioredis
npm install --save class-validator class-transformer
npm install --save @nestjs/event-emitter @nestjs/schedule
npm install --save rxjs

npm install --save-dev @types/passport-jwt @types/node
npm install --save-dev @nestjs/testing @types/jest ts-jest
```

### 2.2 Crear estructura de carpetas

```bash
# Crear estructura de apps y libs
mkdir -p apps/api-gateway/src
mkdir -p apps/device-service/src
mkdir -p apps/analytics-service/src
mkdir -p apps/alerts-service/src
mkdir -p apps/notification-service/src
mkdir -p libs/common/src
mkdir -p libs/database/src
mkdir -p scripts
mkdir -p docs
```

### 2.3 Configurar `nest-cli.json`

```json name=nest-cli.json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/api-gateway/src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": true,
    "tsConfigPath": "apps/api-gateway/tsconfig.app.json"
  },
  "monorepo": true,
  "root": "apps/api-gateway",
  "projects": {
    "api-gateway": {
      "type": "application",
      "root": "apps/api-gateway",
      "entryFile": "main",
      "sourceRoot": "apps/api-gateway/src",
      "compilerOptions": {
        "tsConfigPath": "apps/api-gateway/tsconfig.app.json"
      }
    },
    "device-service": {
      "type": "application",
      "root": "apps/device-service",
      "entryFile": "main",
      "sourceRoot": "apps/device-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/device-service/tsconfig.app.json"
      }
    },
    "analytics-service": {
      "type": "application",
      "root": "apps/analytics-service",
      "entryFile": "main",
      "sourceRoot": "apps/analytics-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/analytics-service/tsconfig.app.json"
      }
    },
    "alerts-service": {
      "type": "application",
      "root": "apps/alerts-service",
      "entryFile": "main",
      "sourceRoot": "apps/alerts-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/alerts-service/tsconfig.app.json"
      }
    },
    "notification-service": {
      "type": "application",
      "root": "apps/notification-service",
      "entryFile": "main",
      "sourceRoot": "apps/notification-service/src",
      "compilerOptions": {
        "tsConfigPath": "apps/notification-service/tsconfig.app.json"
      }
    },
    "common": {
      "type": "library",
      "root": "libs/common",
      "entryFile": "index",
      "sourceRoot": "libs/common/src",
      "compilerOptions": {
        "tsConfigPath": "libs/common/tsconfig.lib.json"
      }
    },
    "database": {
      "type": "library",
      "root": "libs/database",
      "entryFile": "index",
      "sourceRoot": "libs/database/src",
      "compilerOptions": {
        "tsConfigPath": "libs/database/tsconfig.lib.json"
      }
    }
  }
}
```

### 2.4 Actualizar `tsconfig.json`

```json name=tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "paths": {
      "@app/common": ["libs/common/src"],
      "@app/common/*": ["libs/common/src/*"],
      "@app/database": ["libs/database/src"],
      "@app/database/*": ["libs/database/src/*"]
    }
  }
}
```

### 2.5 Crear archivo `.env.example`

```bash name=.env.example
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=iot_user
DB_PASSWORD=iot_password
DB_DATABASE=iot_monitoring

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Kafka
KAFKA_BROKER=kafka:9092

# MQTT
MQTT_BROKER=mqtt://mosquitto:1883

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=3600

# Services Ports
API_GATEWAY_PORT=3000
DEVICE_SERVICE_PORT=3001
ANALYTICS_SERVICE_PORT=3002
ALERTS_SERVICE_PORT=3003
NOTIFICATION_SERVICE_PORT=3004

# Node Environment
NODE_ENV=development
```

### 2.6 Crear `.gitignore`

```bash name=.gitignore
# compiled output
/dist
/node_modules
/.pnp
.pnp.js

# Logs
logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# OS
.DS_Store

# Tests
/coverage
/.nyc_output

# IDEs and editors
/.idea
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace
.vscode/*
!.vscode/extensions.json

# IDE - VSCode
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json

# Environment variables
.env
.env.local
.env.*.local

# Temp
*.swp
*.swo
*~
.tmp
temp/
```

---

## 3. Configuración de Docker

### 3.1 Crear `docker-compose.yml`

```yaml name=docker-compose.yml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: iot-postgres
    environment:
      POSTGRES_USER: iot_user
      POSTGRES_PASSWORD: iot_password
      POSTGRES_DB: iot_monitoring
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - iot-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U iot_user -d iot_monitoring"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    container_name: iot-redis
    ports:
      - "6379:6379"
    networks:
      - iot-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Zookeeper (required for Kafka)
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: iot-zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    networks:
      - iot-network

  # Kafka
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: iot-kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
      - "9093:9093"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:9093
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
    networks:
      - iot-network
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "localhost:9092"]
      interval: 10s
      timeout: 10s
      retries: 5

  # MQTT Broker (Mosquitto)
  mosquitto:
    image: eclipse-mosquitto:2.0
    container_name: iot-mosquitto
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./config/mosquitto.conf:/mosquitto/config/mosquitto.conf
      - mosquitto_data:/mosquitto/data
      - mosquitto_logs:/mosquitto/log
    networks:
      - iot-network

  # Adminer (Database UI)
  adminer:
    image: adminer:latest
    container_name: iot-adminer
    ports:
      - "8080:8080"
    environment:
      ADMINER_DEFAULT_SERVER: postgres
    networks:
      - iot-network
    depends_on:
      - postgres

  # API Gateway
  api-gateway:
    build:
      context: .
      dockerfile: apps/api-gateway/Dockerfile
    container_name: iot-api-gateway
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
      - kafka
    networks:
      - iot-network
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules

  # Device Service
  device-service:
    build:
      context: .
      dockerfile: apps/device-service/Dockerfile
    container_name: iot-device-service
    ports:
      - "3001:3001"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
      - kafka
      - mosquitto
    networks:
      - iot-network
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules

  # Analytics Service
  analytics-service:
    build:
      context: .
      dockerfile: apps/analytics-service/Dockerfile
    container_name: iot-analytics-service
    ports:
      - "3002:3002"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
      - kafka
    networks:
      - iot-network
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules

  # Alerts Service
  alerts-service:
    build:
      context: .
      dockerfile: apps/alerts-service/Dockerfile
    container_name: iot-alerts-service
    ports:
      - "3003:3003"
    env_file:
      - .env
    depends_on:
      - postgres
      - kafka
    networks:
      - iot-network
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules

  # Notification Service
  notification-service:
    build:
      context: .
      dockerfile: apps/notification-service/Dockerfile
    container_name: iot-notification-service
    ports:
      - "3004:3004"
    env_file:
      - .env
    depends_on:
      - redis
      - kafka
    networks:
      - iot-network
    volumes:
      - .:/usr/src/app
      - /usr/src/app/node_modules

networks:
  iot-network:
    driver: bridge

volumes:
  postgres_data:
  mosquitto_data:
  mosquitto_logs:
```

### 3.2 Crear configuración de Mosquitto

```bash
mkdir -p config
```

```conf name=config/mosquitto.conf
# Mosquitto Configuration
listener 1883
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log
log_dest stdout
```

### 3.3 Crear script de inicialización de base de datos

```sql name=scripts/init-db.sql
-- Creación de extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Comentarios para documentación
COMMENT ON DATABASE iot_monitoring IS 'Base de datos para el sistema de monitoreo IoT';
```

---

## 4. Creación de Librerías Compartidas

### 4.1 Librería Common

#### 4.1.1 Crear `libs/common/src/index.ts`

```typescript name=libs/common/src/index.ts
export * from './decorators';
export * from './dto';
export * from './filters';
export * from './interceptors';
export * from './interfaces';
export * from './constants';
```

#### 4.1.2 Crear constantes

```typescript name=libs/common/src/constants/index.ts
export const KAFKA_TOPICS = {
  DEVICE_READINGS: 'device.readings',
  DEVICE_CREATED: 'device.created',
  DEVICE_UPDATED: 'device.updated',
  ALERT_TRIGGERED: 'alert.triggered',
  NOTIFICATION_SENT: 'notification.sent',
};

export const MQTT_TOPICS = {
  DEVICE_DATA: 'iot/devices/+/data',
  DEVICE_STATUS: 'iot/devices/+/status',
};

export const REDIS_KEYS = {
  DEVICE_CACHE: 'device:',
  METRICS_CACHE: 'metrics:',
  ALERT_RULES: 'alert:rules:',
};
```

#### 4.1.3 Crear DTOs base

```typescript name=libs/common/src/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description: 'Número de página',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 10,
    description: 'Elementos por página',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
```

```typescript name=libs/common/src/dto/index.ts
export * from './pagination.dto';
```

#### 4.1.4 Crear interfaces

```typescript name=libs/common/src/interfaces/device-reading.interface.ts
export interface IDeviceReading {
  deviceId: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

```typescript name=libs/common/src/interfaces/index.ts
export * from './device-reading.interface';
```

#### 4.1.5 Crear filtros de excepción

```typescript name=libs/common/src/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

```typescript name=libs/common/src/filters/index.ts
export * from './http-exception.filter';
```

#### 4.1.6 Crear interceptores

```typescript name=libs/common/src/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;
        this.logger.log(
          `${method} ${url} ${response.statusCode} - ${delay}ms`,
        );
      }),
    );
  }
}
```

```typescript name=libs/common/src/interceptors/index.ts
export * from './logging.interceptor';
```

#### 4.1.7 Crear decoradores personalizados

```typescript name=libs/common/src/decorators/api-paginated-response.decorator.ts
import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  totalPages: { type: 'number' },
                },
              },
            },
          },
        ],
      },
    }),
  );
};
```

```typescript name=libs/common/src/decorators/index.ts
export * from './api-paginated-response.decorator';
```

#### 4.1.8 Crear `tsconfig.lib.json` para common

```json name=libs/common/tsconfig.lib.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../dist/libs/common"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### 4.2 Librería Database

#### 4.2.1 Crear entidades

```typescript name=libs/database/src/entities/device.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceReading } from './device-reading.entity';

export enum DeviceType {
  TEMPERATURE_SENSOR = 'TEMPERATURE_SENSOR',
  HUMIDITY_SENSOR = 'HUMIDITY_SENSOR',
  MULTI_SENSOR = 'MULTI_SENSOR',
}

export enum DeviceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

@Entity('devices')
export class Device {
  @ApiProperty({
    description: 'ID único del dispositivo',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Nombre del dispositivo',
    example: 'Sensor Temperatura - Sala 1',
  })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({
    description: 'Tipo de dispositivo',
    enum: DeviceType,
    example: DeviceType.MULTI_SENSOR,
  })
  @Column({
    type: 'enum',
    enum: DeviceType,
    default: DeviceType.MULTI_SENSOR,
  })
  type: DeviceType;

  @ApiProperty({
    description: 'Estado del dispositivo',
    enum: DeviceStatus,
    example: DeviceStatus.ACTIVE,
  })
  @Column({
    type: 'enum',
    enum: DeviceStatus,
    default: DeviceStatus.ACTIVE,
  })
  status: DeviceStatus;

  @ApiProperty({
    description: 'Ubicación del dispositivo',
    example: 'Edificio A - Piso 3 - Sala 101',
  })
  @Column({ nullable: true })
  location: string;

  @ApiProperty({
    description: 'Metadatos adicionales del dispositivo',
    example: { manufacturer: 'ACME', model: 'X-200' },
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2024-01-01T00:00:00.000Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2024-01-01T00:00:00.000Z',
  })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => DeviceReading, (reading) => reading.device)
  readings: DeviceReading[];
}
```

```typescript name=libs/database/src/entities/device-reading.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Device } from './device.entity';

@Entity('device_readings')
@Index(['deviceId', 'timestamp'])
export class DeviceReading {
  @ApiProperty({
    description: 'ID único de la lectura',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'ID del dispositivo',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Column({ name: 'device_id' })
  deviceId: string;

  @ApiProperty({
    description: 'Temperatura en grados Celsius',
    example: 23.5,
    required: false,
  })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  temperature: number;

  @ApiProperty({
    description: 'Humedad en porcentaje',
    example: 65.0,
    required: false,
  })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  humidity: number;

  @ApiProperty({
    description: 'Presión atmosférica en hPa',
    example: 1013.25,
    required: false,
  })
  @Column({ type: 'decimal', precision: 7, scale: 2, nullable: true })
  pressure: number;

  @ApiProperty({
    description: 'Timestamp de la lectura',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Column({ type: 'timestamp' })
  timestamp: Date;

  @ApiProperty({
    description: 'Metadatos adicionales de la lectura',
    example: { battery: 85, signal: -45 },
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Device, (device) => device.readings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
```

```typescript name=libs/database/src/entities/alert-rule.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum AlertCondition {
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  EQUALS = 'EQUALS',
  BETWEEN = 'BETWEEN',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('alert_rules')
export class AlertRule {
  @ApiProperty({ description: 'ID único de la regla de alerta' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Nombre de la regla', example: 'Temperatura Alta' })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({ description: 'Descripción de la regla' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'ID del dispositivo (null para todos)' })
  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @ApiProperty({ description: 'Campo a evaluar', example: 'temperature' })
  @Column({ name: 'metric_field' })
  metricField: string;

  @ApiProperty({ description: 'Condición de la alerta', enum: AlertCondition })
  @Column({
    type: 'enum',
    enum: AlertCondition,
  })
  condition: AlertCondition;

  @ApiProperty({ description: 'Valor umbral', example: 30 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  threshold: number;

  @ApiProperty({ description: 'Valor máximo (para BETWEEN)', required: false })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'threshold_max' })
  thresholdMax: number;

  @ApiProperty({ description: 'Severidad de la alerta', enum: AlertSeverity })
  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.MEDIUM,
  })
  severity: AlertSeverity;

  @ApiProperty({ description: 'Si la regla está activa' })
  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

```typescript name=libs/database/src/entities/alert.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AlertRule, AlertSeverity } from './alert-rule.entity';

export enum AlertStatus {
  TRIGGERED = 'TRIGGERED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

@Entity('alerts')
export class Alert {
  @ApiProperty({ description: 'ID único de la alerta' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'ID de la regla que disparó la alerta' })
  @Column({ name: 'rule_id' })
  ruleId: string;

  @ApiProperty({ description: 'ID del dispositivo' })
  @Column({ name: 'device_id' })
  deviceId: string;

  @ApiProperty({ description: 'Mensaje de la alerta' })
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({ description: 'Severidad de la alerta', enum: AlertSeverity })
  @Column({
    type: 'enum',
    enum: AlertSeverity,
  })
  severity: AlertSeverity;

  @ApiProperty({ description: 'Estado de la alerta', enum: AlertStatus })
  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.TRIGGERED,
  })
  status: AlertStatus;

  @ApiProperty({ description: 'Valor que disparó la alerta' })
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'triggered_value' })
  triggeredValue: number;

  @ApiProperty({ description: 'Datos adicionales de la alerta' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'triggered_at' })
  triggeredAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'acknowledged_at' })
  acknowledgedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'resolved_at' })
  resolvedAt: Date;

  @ManyToOne(() => AlertRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: AlertRule;
}
```

```typescript name=libs/database/src/entities/index.ts
export * from './device.entity';
export * from './device-reading.entity';
export * from './alert-rule.entity';
export * from './alert.entity';
```

#### 4.2.2 Crear módulo de base de datos

```typescript name=libs/database/src/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Device, DeviceReading, AlertRule, Alert } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [Device, DeviceReading, AlertRule, Alert],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
```

```typescript name=libs/database/src/index.ts
export * from './database.module';
export * from './entities';
```

#### 4.2.3 Crear `tsconfig.lib.json` para database

```json name=libs/database/tsconfig.lib.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../dist/libs/database"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

---

## 5. API Gateway

### 5.1 Estructura del API Gateway

```bash
mkdir -p apps/api-gateway/src/{auth,config,devices,health}
```

### 5.2 Crear configuración

```typescript name=apps/api-gateway/src/config/swagger.config.ts
import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('IoT Monitoring Platform - API Gateway')
  .setDescription(
    'API Gateway para el sistema de monitoreo IoT. Punto de entrada principal para todos los servicios.',
  )
  .setVersion('1.0')
  .addTag('auth', 'Autenticación y autorización')
  .addTag('devices', 'Gestión de dispositivos IoT')
  .addTag('analytics', 'Análisis y métricas')
  .addTag('alerts', 'Alertas y notificaciones')
  .addTag('health', 'Estado del sistema')
  .addBearerAuth()
  .build();
```

### 5.3 Crear módulo de autenticación

```typescript name=apps/api-gateway/src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Nombre de usuario',
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Contraseña',
    example: 'admin123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
```

```typescript name=apps/api-gateway/src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, username: payload.username };
  }
}
```

```typescript name=apps/api-gateway/src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

```typescript name=apps/api-gateway/src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(loginDto: LoginDto) {
    // TODO: Validar contra base de datos
    // Por ahora, usuario demo
    if (loginDto.username === 'admin' && loginDto.password === 'admin123') {
      const payload = { username: loginDto.username, sub: '1' };
      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: '1',
          username: loginDto.username,
        },
      };
    }
    throw new Error('Invalid credentials');
  }

  async validateToken(token: string) {
    return this.jwtService.verify(token);
  }
}
```

```typescript name=apps/api-gateway/src/auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'Autentica un usuario y devuelve un JWT token',
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '1',
          username: 'admin',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
```

```typescript name=apps/api-gateway/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '3600s'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

### 5.4 Crear controlador de health check

```typescript name=apps/api-gateway/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Verifica el estado del API Gateway',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio funcionando correctamente',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
        service: 'api-gateway',
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
    };
  }
}
```

### 5.5 Crear módulo principal del Gateway

```typescript name=apps/api-gateway/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

### 5.6 Crear main.ts

```typescript name=apps/api-gateway/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { swaggerConfig } from './config/swagger.config';
import { AllExceptionsFilter } from '@app/common/filters';
import { LoggingInterceptor } from '@app/common/interceptors';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Configuración global
  app.setGlobalPrefix('api/v1');
  app.enableCors();

  // Pipes globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Filters e interceptores
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_GATEWAY_PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 API Gateway running on: http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
```

### 5.7 Crear tsconfig para API Gateway

```json name=apps/api-gateway/tsconfig.app.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/api-gateway"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### 5.8 Crear Dockerfile

```dockerfile name=apps/api-gateway/Dockerfile
FROM node:18-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build api-gateway

FROM node:18-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/api-gateway/main"]
```

---

## 6. Device Service

### 6.1 Estructura

```bash
mkdir -p apps/device-service/src/{devices,mqtt,kafka}
```

### 6.2 Crear DTOs

```typescript name=apps/device-service/src/devices/dto/create-device.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject } from 'class-validator';
import { DeviceType, DeviceStatus } from '@app/database';

export class CreateDeviceDto {
  @ApiProperty({
    description: 'Nombre del dispositivo',
    example: 'Sensor Temperatura - Sala 1',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Tipo de dispositivo',
    enum: DeviceType,
    example: DeviceType.MULTI_SENSOR,
  })
  @IsEnum(DeviceType)
  type: DeviceType;

  @ApiProperty({
    description: 'Estado del dispositivo',
    enum: DeviceStatus,
    example: DeviceStatus.ACTIVE,
    required: false,
  })
  @IsEnum(DeviceStatus)
  @IsOptional()
  status?: DeviceStatus;

  @ApiProperty({
    description: 'Ubicación del dispositivo',
    example: 'Edificio A - Piso 3',
    required: false,
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description: 'Metadatos adicionales',
    example: { manufacturer: 'ACME', model: 'X-200' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
```

```typescript name=apps/device-service/src/devices/dto/update-device.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateDeviceDto } from './create-device.dto';

export class UpdateDeviceDto extends PartialType(CreateDeviceDto) {}
```

### 6.3 Crear servicio de dispositivos

```typescript name=apps/device-service/src/devices/devices.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Device, DeviceReading } from '@app/database';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { PaginationDto } from '@app/common';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(Device)
    private devicesRepository: Repository<Device>,
    @InjectRepository(DeviceReading)
    private readingsRepository: Repository<DeviceReading>,
    private dataSource: DataSource,
  ) {}

  async create(createDeviceDto: CreateDeviceDto): Promise<Device> {
    // Ejemplo de transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const device = this.devicesRepository.create(createDeviceDto);
      const savedDevice = await queryRunner.manager.save(device);

      // Log de auditoría o acciones adicionales
      this.logger.log(`Device created: ${savedDevice.id}`);

      await queryRunner.commitTransaction();
      return savedDevice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating device: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.devicesRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Device> {
    const device = await this.devicesRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }
    return device;
  }

  async update(id: string, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
    const device = await this.findOne(id);
    Object.assign(device, updateDeviceDto);
    return this.devicesRepository.save(device);
  }

  async remove(id: string): Promise<void> {
    const device = await this.findOne(id);
    await this.devicesRepository.remove(device);
  }

  async saveReading(deviceId: string, readingData: any): Promise<DeviceReading> {
    const device = await this.findOne(deviceId);

    const reading = this.readingsRepository.create({
      deviceId: device.id,
      temperature: readingData.temperature,
      humidity: readingData.humidity,
      pressure: readingData.pressure,
      timestamp: new Date(readingData.timestamp || Date.now()),
      metadata: readingData.metadata,
    });

    return this.readingsRepository.save(reading);
  }
}
```

### 6.4 Crear controlador de dispositivos

```typescript name=apps/device-service/src/devices/devices.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device } from '@app/database';
import { PaginationDto, ApiPaginatedResponse } from '@app/common';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear nuevo dispositivo',
    description: 'Crea un nuevo dispositivo IoT en el sistema',
  })
  @ApiResponse({
    status: 201,
    description: 'Dispositivo creado exitosamente',
    type: Device,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@Body() createDeviceDto: CreateDeviceDto) {
    return this.devicesService.create(createDeviceDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar dispositivos',
    description: 'Obtiene una lista paginada de dispositivos',
  })
  @ApiPaginatedResponse(Device)
  findAll(@Query() paginationDto: PaginationDto) {
    return this.devicesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener dispositivo',
    description: 'Obtiene un dispositivo específico por su ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Dispositivo encontrado',
    type: Device,
  })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar dispositivo',
    description: 'Actualiza la información de un dispositivo',
  })
  @ApiResponse({
    status: 200,
    description: 'Dispositivo actualizado',
    type: Device,
  })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(id, updateDeviceDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar dispositivo',
    description: 'Elimina un dispositivo del sistema',
  })
  @ApiResponse({ status: 200, description: 'Dispositivo eliminado' })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.devicesService.remove(id);
  }
}
```

### 6.5 Crear módulo de dispositivos

```typescript name=apps/device-service/src/devices/devices.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device, DeviceReading } from '@app/database';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [TypeOrmModule.forFeature([Device, DeviceReading])],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
```

### 6.6 Crear cliente MQTT

```typescript name=apps/device-service/src/mqtt/mqtt.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { DevicesService } from '../devices/devices.service';
import { KafkaService } from '../kafka/kafka.service';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;

  constructor(
    private configService: ConfigService,
    private devicesService: DevicesService,
    private kafkaService: KafkaService,
  ) {}

  async onModuleInit() {
    const brokerUrl = this.configService.get<string>('MQTT_BROKER');
    this.logger.log(`Connecting to MQTT broker: ${brokerUrl}`);

    this.client = mqtt.connect(brokerUrl);

    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker');
      this.client.subscribe('iot/devices/+/data', (err) => {
        if (err) {
          this.logger.error(`Error subscribing to topic: ${err.message}`);
        } else {
          this.logger.log('Subscribed to iot/devices/+/data');
        }
      });
    });

    this.client.on('message', async (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        const deviceId = topic.split('/')[2];

        this.logger.log(`Received data from device ${deviceId}: ${payload.toString()}`);

        // Guardar lectura en la base de datos
        const reading = await this.devicesService.saveReading(deviceId, data);

        // Publicar en Kafka
        await this.kafkaService.publishReading(reading);
      } catch (error) {
        this.logger.error(`Error processing MQTT message: ${error.message}`);
      }
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });
  }
}
```

```typescript name=apps/device-service/src/mqtt/mqtt.module.ts
import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { DevicesModule } from '../devices/devices.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [DevicesModule, KafkaModule],
  providers: [MqttService],
})
export class MqttModule {}
```

### 6.7 Crear producer Kafka

```typescript name=apps/device-service/src/kafka/kafka.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { KAFKA_TOPICS } from '@app/common/constants';

@Injectable()
export class KafkaService implements OnModuleInit {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;

  constructor(private configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: 'device-service',
      brokers: [this.configService.get<string>('KAFKA_BROKER')],
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async publishReading(reading: any) {
    try {
      await this.producer.send({
        topic: KAFKA_TOPICS.DEVICE_READINGS,
        messages: [
          {
            key: reading.deviceId,
            value: JSON.stringify(reading),
          },
        ],
      });
      this.logger.log(`Published reading to Kafka: ${reading.id}`);
    } catch (error) {
      this.logger.error(`Error publishing to Kafka: ${error.message}`);
    }
  }
}
```

```typescript name=apps/device-service/src/kafka/kafka.module.ts
import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';

@Module({
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
```

### 6.8 Crear app module

```typescript name=apps/device-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { DevicesModule } from './devices/devices.module';
import { MqttModule } from './mqtt/mqtt.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    DevicesModule,
    MqttModule,
    KafkaModule,
  ],
})
export class AppModule {}
```

### 6.9 Crear main.ts

```typescript name=apps/device-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from '@app/common/filters';
import { LoggingInterceptor } from '@app/common/interceptors';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setG