import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { KafkaModule } from '../kafka/kafka.module';
import { MqttService } from './mqtt.service';

@Module({
  imports: [DevicesModule, KafkaModule],
  providers: [MqttService],
})
export class MqttModule {}
