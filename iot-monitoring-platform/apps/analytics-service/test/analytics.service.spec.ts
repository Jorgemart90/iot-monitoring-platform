import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeviceReading } from '@app/database';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { MetricsProcessor } from '../src/analytics/strategies/metrics-processor';
import { TemperatureStrategy } from '../src/analytics/strategies/temperature.strategy';
import { HumidityStrategy } from '../src/analytics/strategies/humidity.strategy';
import { PressureStrategy } from '../src/analytics/strategies/pressure.strategy';
import { MetricResult } from '../src/analytics/strategies/metrics.strategy.interface';

const mockRedisService = {
  hgetall: jest.fn(),
  hset: jest.fn(),
};

const mockReadingRepository = {
  findAndCount: jest.fn(),
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let processor: MetricsProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        MetricsProcessor,
        TemperatureStrategy,
        HumidityStrategy,
        PressureStrategy,
        { provide: getRepositoryToken(DeviceReading), useValue: mockReadingRepository },
        { provide: 'RedisService', useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    processor = module.get<MetricsProcessor>(MetricsProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  describe('MetricsProcessor strategy pattern', () => {
    it('should compute initial metrics for a new reading', () => {
      const reading = { deviceId: 'dev-1', temperature: 30, humidity: 55 };
      const result = processor.processReading(reading, new Map());

      const temp = result.get('temperature');
      expect(temp.value).toBe(30);
      expect(temp.min).toBe(30);
      expect(temp.max).toBe(30);
      expect(temp.avg).toBe(30);
      expect(temp.count).toBe(1);
    });

    it('should update running avg/min/max on subsequent readings', () => {
      const first = { deviceId: 'dev-1', temperature: 20 };
      const second = { deviceId: 'dev-1', temperature: 40 };

      let metrics = processor.processReading(first, new Map());
      metrics = processor.processReading(second, metrics);

      const temp = metrics.get('temperature');
      expect(temp.min).toBe(20);
      expect(temp.max).toBe(40);
      expect(temp.avg).toBe(30);
      expect(temp.count).toBe(2);
    });

    it('should handle missing fields gracefully', () => {
      const reading = { deviceId: 'dev-1', temperature: 25 }; // no humidity
      const result = processor.processReading(reading, new Map());

      expect(result.has('temperature')).toBe(true);
      expect(result.has('humidity')).toBe(false);
    });
  });

  describe('processReading', () => {
    it('should load from Redis, process, and save back', async () => {
      mockRedisService.hgetall.mockResolvedValue({});
      mockRedisService.hset.mockResolvedValue(undefined);

      await service.processReading({ deviceId: 'dev-1', temperature: 28 });

      expect(mockRedisService.hgetall).toHaveBeenCalledWith('metrics:dev-1');
      expect(mockRedisService.hset).toHaveBeenCalled();
    });
  });
});
