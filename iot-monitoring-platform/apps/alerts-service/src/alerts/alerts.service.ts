import { AlertQueryDto } from './dto/alert-query.dto';
import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertStatus, UserRole } from '@app/database';
import { AuthUser } from '@app/common';
import { AlertRule } from '@app/database';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
  ) {}

  async create(data: {
    rule: AlertRule;
    deviceId: string;
    triggeredValue: number;
    message: string;
  }): Promise<Alert> {
    const alert = this.alertRepository.create({
      ruleId: data.rule.id,
      deviceId: data.deviceId,
      message: data.message,
      metadata: { color: data.rule.color || null, zone: data.rule.zone ?? null },
      severity: data.rule.severity,
      triggeredValue: data.triggeredValue,
      status: AlertStatus.TRIGGERED,
    });
    const saved = await this.alertRepository.save(alert);
    this.logger.warn(`Alert created: ${saved.id} for device ${data.deviceId}`);
    return saved;
  }

  async summary(user: AuthUser) {
    const query = this.alertRepository
      .createQueryBuilder('alert')
      .innerJoin('alert.rule', 'rule')
      .select('alert.severity', 'severity')
      .addSelect('COUNT(*)::int', 'count')
      .where('alert.status = :status', { status: AlertStatus.TRIGGERED });
    if (user.role !== UserRole.MASTER)
      query.andWhere('rule.owner_id = :owner', { owner: user.userId });
    const rows = await query.groupBy('alert.severity').getRawMany();
    const bySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const row of rows) bySeverity[row.severity] = Number(row.count);
    return { total: Object.values(bySeverity).reduce((sum, value) => sum + value, 0), bySeverity };
  }

  async findAll(query: AlertQueryDto, user: AuthUser) {
    if (query.from && query.to && Date.parse(query.from) >= Date.parse(query.to))
      throw new BadRequestException('El inicio debe ser anterior al fin');
    const { page = 1, limit = 10 } = query;
    const builder = this.alertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.rule', 'rule')
      .leftJoin('rule.owner', 'owner')
      .leftJoin('devices', 'device', 'device.id::text = alert.device_id');
    if (user.role !== UserRole.MASTER)
      builder.andWhere('rule.owner_id = :ownerId', { ownerId: user.userId });
    if (query.from) builder.andWhere('alert.triggered_at >= :from', { from: new Date(query.from) });
    if (query.to) builder.andWhere('alert.triggered_at < :to', { to: new Date(query.to) });
    if (query.deviceId)
      builder.andWhere('alert.device_id = :deviceId', { deviceId: query.deviceId });
    if (query.zone === '__none__')
      builder.andWhere("(device.location IS NULL OR TRIM(device.location) = '')");
    else if (query.zone)
      builder.andWhere('TRIM(device.location) = :zone', { zone: query.zone.trim() });
    if (query.severity)
      builder.andWhere('alert.severity = :severity', { severity: query.severity });
    if (query.status) builder.andWhere('alert.status = :status', { status: query.status });
    if (query.metricField)
      builder.andWhere('rule.metric_field = :metricField', { metricField: query.metricField });
    const [data, total] = await builder
      .orderBy('alert.triggeredAt', 'DESC')
      .addOrderBy('alert.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
  async findOne(id: string, user: AuthUser): Promise<Alert> {
    const alert = await this.alertRepository.findOne({
      where: user.role === UserRole.MASTER ? { id } : { id, rule: { ownerId: user.userId } },
      relations: ['rule'],
    });
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  async acknowledge(id: string, user: AuthUser): Promise<Alert> {
    const alert = await this.findOne(id, user);
    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    return this.alertRepository.save(alert);
  }

  async resolve(id: string, user: AuthUser): Promise<Alert> {
    const alert = await this.findOne(id, user);
    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    return this.alertRepository.save(alert);
  }
}
