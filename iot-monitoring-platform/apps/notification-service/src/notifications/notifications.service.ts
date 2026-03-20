import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { SseService } from '../sse/sse.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly sseService: SseService,
  ) {}

  async onModuleInit() {
    await this.redisService.subscribe('notifications', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.sseService.emit({
          id: data.alertId,
          type: 'alert',
          data,
        });
        this.logger.debug(`Notification broadcast to ${this.sseService.getConnectedClientsCount()} clients`);
      } catch (error) {
        this.logger.error('Failed to process notification', error);
      }
    });
    this.logger.log('Notification service subscribed to Redis notifications channel');
  }
}
