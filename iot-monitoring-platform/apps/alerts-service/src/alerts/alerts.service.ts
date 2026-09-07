import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertStatus, UserRole } from '@app/database';
import { AuthUser, PaginationDto } from '@app/common';
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

  async findAll(paginationDto: PaginationDto, user: AuthUser) {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.alertRepository.findAndCount({
      where: user.role === UserRole.MASTER ? {} : { rule: { ownerId: user.userId } },
      skip: (page - 1) * limit,
      take: limit,
      order: { triggeredAt: 'DESC' },
      relations: ['rule'],
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
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
