import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule, AlertCondition } from '@app/database';
import { PaginationDto } from '@app/common';
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
  ) {}

  async create(createRuleDto: CreateRuleDto): Promise<AlertRule> {
    const existing = await this.ruleRepository.findOne({
      where: { name: createRuleDto.name },
    });
    if (existing) {
      throw new ConflictException(`Alert rule with name "${createRuleDto.name}" already exists`);
    }
    const rule = this.ruleRepository.create(createRuleDto);
    return this.ruleRepository.save(rule);
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.ruleRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<AlertRule> {
    const rule = await this.ruleRepository.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`AlertRule ${id} not found`);
    return rule;
  }

  async update(id: string, updateRuleDto: UpdateRuleDto): Promise<AlertRule> {
    const rule = await this.findOne(id);
    if (updateRuleDto.name && updateRuleDto.name !== rule.name) {
      const existing = await this.ruleRepository.findOne({
        where: { name: updateRuleDto.name },
      });
      if (existing) {
        throw new ConflictException(`Alert rule with name "${updateRuleDto.name}" already exists`);
      }
    }
    Object.assign(rule, updateRuleDto);
    return this.ruleRepository.save(rule);
  }

  async remove(id: string): Promise<void> {
    const rule = await this.findOne(id);
    await this.ruleRepository.remove(rule);
  }

  async evaluateReading(reading: IDeviceReading): Promise<TriggeredRule[]> {
    const rules = await this.ruleRepository.find({
      where: { isActive: true },
    });

    const triggered: TriggeredRule[] = [];

    for (const rule of rules) {
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
