import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
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
    await this.validateRule(createRuleDto, user);
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
    const candidate = { ...rule, ...updateRuleDto };
    await this.validateRule(
      candidate,
      user,
      rule.ownerId,
      ['zone', 'deviceId', 'deviceIds'].some((key) =>
        Object.prototype.hasOwnProperty.call(updateRuleDto, key),
      ),
    );
    Object.assign(rule, updateRuleDto);
    return this.ruleRepository.save(rule);
  }

  private async validateRule(
    rule: Partial<AlertRule>,
    user: AuthUser,
    ownerId = user.userId,
    validateTargets = true,
  ) {
    if (
      !rule.name?.trim() ||
      !['temperature', 'humidity', 'pressure'].includes(rule.metricField) ||
      !Object.values(AlertCondition).includes(rule.condition) ||
      rule.threshold == null ||
      !Number.isFinite(Number(rule.threshold)) ||
      !rule.severity ||
      rule.isActive === null
    )
      throw new BadRequestException('Completa el nombre, métrica, condición, umbral y severidad');
    const ranged = [AlertCondition.BETWEEN, AlertCondition.OUTSIDE_RANGE].includes(rule.condition);
    if (
      ranged &&
      (rule.thresholdMax == null ||
        !Number.isFinite(Number(rule.thresholdMax)) ||
        Number(rule.thresholdMax) <= Number(rule.threshold))
    )
      throw new BadRequestException('El límite superior debe ser mayor que el inferior');
    const limits =
      rule.metricField === 'temperature'
        ? [-273.15, 500]
        : rule.metricField === 'humidity'
          ? [0, 100]
          : [0, 99999999.99];
    for (const value of [rule.threshold, ...(ranged ? [rule.thresholdMax] : [])]) {
      if (Number(value) < limits[0] || Number(value) > limits[1])
        throw new BadRequestException(
          'El umbral está fuera del intervalo permitido para esta métrica',
        );
    }
    if (rule.deviceId && rule.deviceIds != null)
      throw new BadRequestException('Usa deviceId o deviceIds, no ambos');
    const ids = rule.deviceIds ?? (rule.deviceId ? [rule.deviceId] : []);
    if (!validateTargets) return;
    for (const id of ids) {
      const device = await this.deviceRepository.findOne({ where: { id } });
      if (
        !device ||
        (user.role !== UserRole.MASTER && device.ownerId !== user.userId) ||
        (ownerId !== user.userId && device.ownerId !== ownerId)
      )
        throw new ForbiddenException('No puedes asociar ese dispositivo a la regla');
      if (rule.zone != null && (device.location?.trim() || '') !== rule.zone.trim())
        throw new BadRequestException(
          'Todos los dispositivos seleccionados deben pertenecer a la zona',
        );
    }
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const rule = await this.findOne(id, user);
    await this.ruleRepository.remove(rule);
  }

  private automaticMessage(rule: AlertRule, value: number): string {
    const metric =
      { temperature: 'Temperatura', humidity: 'Humedad', pressure: 'Presión' }[rule.metricField] ||
      rule.metricField;
    const unit = { temperature: ' °C', humidity: ' %', pressure: ' hPa' }[rule.metricField] || '';
    const format = (n: number) =>
      Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 }) + unit;
    const condition = {
      GREATER_THAN: 'Supera el umbral de ' + format(rule.threshold),
      LESS_THAN: 'Está por debajo del umbral de ' + format(rule.threshold),
      EQUALS: 'Es igual al umbral de ' + format(rule.threshold),
      BETWEEN:
        'Está dentro del rango de ' + format(rule.threshold) + ' a ' + format(rule.thresholdMax),
      OUTSIDE_RANGE:
        'Está fuera del rango de ' + format(rule.threshold) + ' a ' + format(rule.thresholdMax),
    }[rule.condition];
    return metric + ': ' + format(value) + '. ' + condition + '.';
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
    if (!device) return triggered;

    for (const rule of rules) {
      if (rule.owner?.role === UserRole.DEMO && rule.ownerId !== device?.ownerId) continue;
      if (rule.zone != null && (device.location?.trim() || '') !== rule.zone.trim()) continue;
      if (rule.deviceIds && !rule.deviceIds.includes(reading.deviceId)) continue;
      // Las reglas existentes de un solo sensor conservan su alcance.
      if (rule.deviceId && rule.deviceId !== reading.deviceId) continue;

      const fieldValue = reading[rule.metricField as keyof IDeviceReading] as number;
      if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) continue;

      let isTriggered = false;

      switch (rule.condition) {
        case AlertCondition.GREATER_THAN:
          isTriggered = fieldValue > rule.threshold;
          break;
        case AlertCondition.LESS_THAN:
          isTriggered = fieldValue < rule.threshold;
          break;
        case AlertCondition.EQUALS:
          isTriggered = fieldValue === Number(rule.threshold);
          break;
        case AlertCondition.BETWEEN:
          isTriggered =
            rule.thresholdMax != null &&
            fieldValue >= rule.threshold &&
            fieldValue <= rule.thresholdMax;
          break;
      }

      if (rule.condition === AlertCondition.OUTSIDE_RANGE && rule.thresholdMax != null)
        isTriggered = fieldValue < Number(rule.threshold) || fieldValue > Number(rule.thresholdMax);
      if (isTriggered) {
        triggered.push({
          rule,
          triggeredValue: fieldValue,
          message: rule.customMessage?.trim() || this.automaticMessage(rule, fieldValue),
        });
      }
    }

    return triggered;
  }
}
