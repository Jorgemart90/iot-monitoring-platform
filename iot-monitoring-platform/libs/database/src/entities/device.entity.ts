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
  @ApiProperty({ description: 'UUID del dispositivo' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Nombre del dispositivo' })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({ enum: DeviceType, description: 'Tipo de dispositivo' })
  @Column({ type: 'enum', enum: DeviceType, default: DeviceType.MULTI_SENSOR })
  type: DeviceType;

  @ApiProperty({ enum: DeviceStatus, description: 'Estado del dispositivo' })
  @Column({ type: 'enum', enum: DeviceStatus, default: DeviceStatus.ACTIVE })
  status: DeviceStatus;

  @ApiProperty({ description: 'Ubicación del dispositivo', required: false })
  @Column({ nullable: true })
  location: string;

  @ApiProperty({ description: 'Metadatos adicionales', required: false })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => DeviceReading, (reading) => reading.device)
  readings: DeviceReading[];
}
