import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { KafkaService } from './kafka.service';

@Module({
  imports: [RedisModule],
  providers: [KafkaService],
})
export class KafkaModule {}
