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
import { AlertRule, AlertSeverity } from './alert-rule.entity';

export enum AlertStatus {
  TRIGGERED = 'TRIGGERED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

@Entity('alerts')
// El dashboard filtra por estado y ordena por fecha en cada carga.
// Nombres explícitos para que las migraciones no dependan del hash de TypeORM.
@Index('idx_alerts_status', ['status'])
@Index('idx_alerts_triggered_at', ['triggeredAt'])
export class Alert {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId: string;

  @ApiProperty()
  @Column({ name: 'device_id', type: 'uuid' })
  deviceId: string;

  @ApiProperty()
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({ enum: AlertSeverity })
  @Column({ type: 'enum', enum: AlertSeverity })
  severity: AlertSeverity;

  @ApiProperty({ enum: AlertStatus })
  @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.TRIGGERED })
  status: AlertStatus;

  @ApiProperty()
  @Column({ name: 'triggered_value', type: 'decimal', precision: 10, scale: 2 })
  triggeredValue: number;

  @ApiProperty({ required: false })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ApiProperty()
  @CreateDateColumn({ name: 'triggered_at' })
  triggeredAt: Date;

  @ApiProperty({ required: false })
  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @ApiProperty({ required: false })
  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @ManyToOne(() => AlertRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: AlertRule;
}
