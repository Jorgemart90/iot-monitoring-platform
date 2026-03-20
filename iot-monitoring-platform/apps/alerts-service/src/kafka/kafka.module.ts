import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module';
import { AlertsModule } from '../alerts/alerts.module';
import { KafkaService } from './kafka.service';

@Module({
  imports: [RulesModule, AlertsModule],
  providers: [KafkaService],
})
export class KafkaModule {}
