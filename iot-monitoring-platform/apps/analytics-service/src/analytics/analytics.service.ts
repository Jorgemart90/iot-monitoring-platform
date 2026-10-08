import { HistoryQueryDto } from './dto/history-query.dto';
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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

  async getHistory(deviceId: string, query: HistoryQueryDto, user: AuthUser) {
    await this.assertDeviceAccess(deviceId, user);
    const start = Date.parse(query.from),
      end = Date.parse(query.to);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > 366 * 86400000
    )
      throw new BadRequestException(
        'El intervalo debe ser válido, creciente y no superar 366 días',
      );
    const bucketSeconds = Math.max(1, (end - start) / 1000 / (query.points ?? 240));
    const data = await this.readingRepository.query(
      `
      SELECT MIN(timestamp) AS timestamp, AVG(temperature)::float8 AS temperature,
             MIN(temperature)::float8 AS min, MAX(temperature)::float8 AS max,
             COUNT(*)::int AS count
      FROM device_readings
      WHERE device_id = $1 AND timestamp >= $2::timestamp AND timestamp < $3::timestamp
            AND temperature IS NOT NULL
      GROUP BY FLOOR(EXTRACT(EPOCH FROM (timestamp - $2::timestamp)) / $4)
      ORDER BY MIN(timestamp) ASC
    `,
      [deviceId, new Date(start).toISOString(), new Date(end).toISOString(), bucketSeconds],
    );
    return {
      data,
      meta: {
        from: query.from,
        to: query.to,
        bucketSeconds,
        aggregation: 'average',
        totalReadings: data.reduce((sum, point) => sum + point.count, 0),
      },
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
