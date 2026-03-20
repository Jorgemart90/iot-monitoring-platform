import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertStatus } from '@app/database';
import { PaginationDto } from '@app/common';
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
      severity: data.rule.severity,
      triggeredValue: data.triggeredValue,
      status: AlertStatus.TRIGGERED,
    });
    const saved = await this.alertRepository.save(alert);
    this.logger.warn(`Alert created: ${saved.id} for device ${data.deviceId}`);
    return saved;
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.alertRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { triggeredAt: 'DESC' },
      relations: ['rule'],
    });
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({
      where: { id },
      relations: ['rule'],
    });
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  async acknowledge(id: string): Promise<Alert> {
    const alert = await this.findOne(id);
    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    return this.alertRepository.save(alert);
  }

  async resolve(id: string): Promise<Alert> {
    const alert = await this.findOne(id);
    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    return this.alertRepository.save(alert);
  }
}
