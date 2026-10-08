import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

export enum AlertCondition {
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  EQUALS = 'EQUALS',
  BETWEEN = 'BETWEEN',
  OUTSIDE_RANGE = 'OUTSIDE_RANGE',
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
  @Column({ length: 255 })
  name: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({
    description: 'Null = aplica a todos los dispositivos',
    required: false,
  })
  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @ApiProperty({ required: false, description: 'Zona exacta; cadena vacía = sin zona' })
  @Column({ type: 'varchar', length: 150, nullable: true })
  zone?: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Sensores seleccionados; null = todos los de la zona',
  })
  @Column({ name: 'device_ids', type: 'jsonb', nullable: true })
  deviceIds?: string[];

  @ApiProperty({ required: false, maxLength: 500 })
  @Column({ name: 'custom_message', type: 'varchar', length: 500, nullable: true })
  customMessage?: string;

  @ApiProperty({ required: false, example: '#db6a32' })
  @Column({ type: 'varchar', length: 7, nullable: true })
  color?: string;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

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
  @Column({
    name: 'threshold_max',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
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
