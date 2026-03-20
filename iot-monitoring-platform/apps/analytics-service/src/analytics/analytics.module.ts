import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceReading } from '@app/database';
import { RedisModule } from '../redis/redis.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MetricsProcessor } from './strategies/metrics-processor';
import { TemperatureStrategy } from './strategies/temperature.strategy';
import { HumidityStrategy } from './strategies/humidity.strategy';
import { PressureStrategy } from './strategies/pressure.strategy';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceReading]), RedisModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    MetricsProcessor,
    TemperatureStrategy,
    HumidityStrategy,
    PressureStrategy,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
