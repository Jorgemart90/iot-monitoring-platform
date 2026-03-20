import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { KafkaService } from './kafka.service';

@Module({
  imports: [AnalyticsModule],
  providers: [KafkaService],
})
export class KafkaModule {}
