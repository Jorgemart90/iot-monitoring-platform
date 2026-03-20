import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private publisher: Redis;
  private subscriber: Redis;

  constructor(private readonly configService: ConfigService) {
    const options = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    };
    this.publisher = new Redis(options);
    this.subscriber = new Redis(options);
  }

  onModuleInit() {
    this.publisher.on('connect', () => this.logger.log('Redis publisher connected'));
    this.subscriber.on('connect', () => this.logger.log('Redis subscriber connected'));
    this.publisher.on('error', (err) => this.logger.error('Redis publisher error', err));
    this.subscriber.on('error', (err) => this.logger.error('Redis subscriber error', err));
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.publisher.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (chan: string, msg: string) => {
      if (chan === channel) {
        callback(msg);
      }
    });
  }
}
