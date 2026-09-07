import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceReading } from './device-reading.entity';
import { User } from './user.entity';

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

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @ManyToOne(() => User, (user) => user.devices, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @Column({ name: 'is_demo', default: false })
  isDemo: boolean;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => DeviceReading, (reading) => reading.device)
  readings: DeviceReading[];
}
