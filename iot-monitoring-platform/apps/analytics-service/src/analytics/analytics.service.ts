import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device, DeviceReading, UserRole } from '@app/database';
import { AuthUser, PaginationDto, REDIS_KEYS } from '@app/common';
import { RedisService } from '../redis/redis.service';
import { MetricsProcessor } from './strategies/metrics-processor';
import { MetricResult } from './strategies/metrics.strategy.interface';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(DeviceReading)
    private readonly readingRepository: Repository<DeviceReading>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly redisService: RedisService,
    private readonly metricsProcessor: MetricsProcessor,
  ) {}

  async processReading(reading: Record<string, any>): Promise<void> {
    const deviceId = reading.deviceId;
    if (!deviceId) return;

    const cacheKey = `${REDIS_KEYS.METRICS_CACHE}${deviceId}`;

    // Load existing metrics from Redis
    const cached = await this.redisService.hgetall(cacheKey);
    const existingMetrics = new Map<string, MetricResult>();

    for (const [field, raw] of Object.entries(cached || {})) {
      try {
        existingMetrics.set(field, JSON.parse(raw));
      } catch {
        // ignore malformed cache
      }
    }

    // Process with Strategy Pattern
    const updated = this.metricsProcessor.processReading(reading, existingMetrics);

    // Persist updated metrics back to Redis
    for (const [field, result] of updated.entries()) {
      await this.redisService.hset(cacheKey, field, JSON.stringify(result));
    }

    this.logger.debug(`Metrics updated for device ${deviceId}`);
  }

  async getMetrics(deviceId: string, user: AuthUser): Promise<Record<string, MetricResult>> {
    await this.assertDeviceAccess(deviceId, user);
    const cacheKey = `${REDIS_KEYS.METRICS_CACHE}${deviceId}`;
    const cached = await this.redisService.hgetall(cacheKey);
    const result: Record<string, MetricResult> = {};

    for (const [field, raw] of Object.entries(cached || {})) {
      try {
        result[field] = JSON.parse(raw);
      } catch {
        // skip
      }
    }

    return result;
  }

  async getReadings(deviceId: string, paginationDto: PaginationDto, user: AuthUser) {
    await this.assertDeviceAccess(deviceId, user);
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.readingRepository.findAndCount({
      where: { deviceId },
      order: { timestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async assertDeviceAccess(deviceId: string, user: AuthUser): Promise<void> {
    const where =
      user.role === UserRole.MASTER ? { id: deviceId } : { id: deviceId, ownerId: user.userId };
    if (!(await this.deviceRepository.exist({ where }))) {
      throw new NotFoundException(`Device with id ${deviceId} not found`);
    }
  }
}
