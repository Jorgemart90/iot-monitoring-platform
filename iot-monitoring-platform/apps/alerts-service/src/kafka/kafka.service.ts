import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, Producer } from 'kafkajs';
import { KAFKA_TOPICS } from '@app/common';
import { RulesService } from '../rules/rules.service';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private consumer: Consumer;
  private producer: Producer;

  constructor(
    private readonly configService: ConfigService,
    private readonly rulesService: RulesService,
    private readonly alertsService: AlertsService,
  ) {
    const kafka = new Kafka({
      clientId: 'alerts-service',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
    });
    this.consumer = kafka.consumer({ groupId: 'alerts-service' });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.DEVICE_READINGS,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const reading = JSON.parse(message.value.toString());
          const triggered = await this.rulesService.evaluateReading(reading);

          for (const { rule, triggeredValue, message: alertMessage } of triggered) {
            const alert = await this.alertsService.create({
              rule,
              deviceId: reading.deviceId,
              triggeredValue,
              message: alertMessage,
            });

            await this.producer.send({
              topic: KAFKA_TOPICS.ALERT_TRIGGERED,
              messages: [
                {
                  key: alert.deviceId,
                  value: JSON.stringify({
                    alertId: alert.id,
                    deviceId: alert.deviceId,
                    ruleId: alert.ruleId,
                    message: alert.message,
                    severity: alert.severity,
                    triggeredAt: alert.triggeredAt,
                  }),
                },
              ],
            });
          }
        } catch (error) {
          this.logger.error('Error processing Kafka message in alerts service', error);
        }
      },
    });

    this.logger.log('Alerts Kafka consumer/producer connected');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }
}
