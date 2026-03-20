import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { SseService } from '../sse/sse.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [RedisModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SseService],
})
export class NotificationsModule {}
