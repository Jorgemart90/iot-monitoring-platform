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
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ length: 255, unique: true })
  name: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ description: 'Null = aplica a todos los dispositivos', required: false })
  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string;

  @ApiProperty({ description: 'Campo a evaluar (ej: temperature, humidity)' })
  @Column({ name: 'metric_field', length: 100 })
  metricField: string;

  @ApiProperty({ enum: AlertCondition })
  @Column({ type: 'enum', enum: AlertCondition })
  condition: AlertCondition;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  threshold: number;

  @ApiProperty({ description: 'Usado para condición BETWEEN', required: false })
  @Column({ name: 'threshold_max', type: 'decimal', precision: 10, scale: 2, nullable: true })
  thresholdMax: number;

  @ApiProperty({ enum: AlertSeverity })
  @Column({ type: 'enum', enum: AlertSeverity, default: AlertSeverity.MEDIUM })
  severity: AlertSeverity;

  @ApiProperty()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
