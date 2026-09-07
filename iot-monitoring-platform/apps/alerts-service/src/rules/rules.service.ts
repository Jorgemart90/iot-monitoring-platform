import { ForbiddenException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule, AlertCondition, Device, UserRole } from '@app/database';
import { AuthUser, PaginationDto } from '@app/common';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { IDeviceReading } from '@app/common';

export interface TriggeredRule {
  rule: AlertRule;
  triggeredValue: number;
  message: string;
}

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(
    @InjectRepository(AlertRule)
    private readonly ruleRepository: Repository<AlertRule>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  async create(createRuleDto: CreateRuleDto, user: AuthUser): Promise<AlertRule> {
    if (user.role === UserRole.DEMO) {
      const count = await this.ruleRepository.count({
        where: { ownerId: user.userId },
      });
      if (count >= 3)
        throw new ForbiddenException('Los usuarios demo pueden crear máximo 3 reglas');
      if (createRuleDto.deviceId) {
        const device = await this.deviceRepository.findOne({
          where: { id: createRuleDto.deviceId, ownerId: user.userId },
        });
        if (!device) throw new ForbiddenException('El dispositivo no pertenece al usuario demo');
      }
    }
    const rule = this.ruleRepository.create({
      ...createRuleDto,
      ownerId: user.userId,
    });
    return this.ruleRepository.save(rule);
  }

  async findAll(paginationDto: PaginationDto, user: AuthUser) {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.ruleRepository.findAndCount({
      where: user.role === UserRole.MASTER ? {} : { ownerId: user.userId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: AuthUser): Promise<AlertRule> {
    const where = user.role === UserRole.MASTER ? { id } : { id, ownerId: user.userId };
    const rule = await this.ruleRepository.findOne({ where });
    if (!rule) throw new NotFoundException(`AlertRule ${id} not found`);
    return rule;
  }

  async update(id: string, updateRuleDto: UpdateRuleDto, user: AuthUser): Promise<AlertRule> {
    const rule = await this.findOne(id, user);
    Object.assign(rule, updateRuleDto);
    return this.ruleRepository.save(rule);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const rule = await this.findOne(id, user);
    await this.ruleRepository.remove(rule);
  }

  async evaluateReading(reading: IDeviceReading): Promise<TriggeredRule[]> {
    const rules = await this.ruleRepository.find({
      where: { isActive: true },
      relations: ['owner'],
    });

    const device = await this.deviceRepository.findOne({
      where: { id: reading.deviceId },
    });

    const triggered: TriggeredRule[] = [];

    for (const rule of rules) {
      if (rule.owner?.role === UserRole.DEMO && rule.ownerId !== device?.ownerId) continue;
      // Skip if rule is for a specific device and this isn't it
      if (rule.deviceId && rule.deviceId !== reading.deviceId) continue;

      const fieldValue = reading[rule.metricField as keyof IDeviceReading] as number;
      if (fieldValue === undefined || fieldValue === null) continue;

      let isTriggered = false;

      switch (rule.condition) {
        case AlertCondition.GREATER_THAN:
          isTriggered = fieldValue > rule.threshold;
          break;
        case AlertCondition.LESS_THAN:
          isTriggered = fieldValue < rule.threshold;
          break;
        case AlertCondition.EQUALS:
          isTriggered = fieldValue === rule.threshold;
          break;
        case AlertCondition.BETWEEN:
          isTriggered =
            rule.thresholdMax !== null &&
            fieldValue >= rule.threshold &&
            fieldValue <= rule.thresholdMax;
          break;
      }

      if (isTriggered) {
        triggered.push({
          rule,
          triggeredValue: fieldValue,
          message: `Rule "${rule.name}" triggered: ${rule.metricField} = ${fieldValue} (condition: ${rule.condition} ${rule.threshold}${rule.thresholdMax ? '-' + rule.thresholdMax : ''})`,
        });
      }
    }

    return triggered;
  }
}
