import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { DevicesService } from '../devices/devices.service';
import { KafkaService } from '../kafka/kafka.service';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly devicesService: DevicesService,
    private readonly kafkaService: KafkaService,
  ) {}

  onModuleInit() {
    const brokerUrl = this.configService.get<string>('MQTT_BROKER', 'mqtt://localhost:1883');
    this.client = mqtt.connect(brokerUrl);

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${brokerUrl}`);
      this.client.subscribe('iot/devices/+/data', (err) => {
        if (err) {
          this.logger.error('Failed to subscribe to MQTT topic', err);
        } else {
          this.logger.log('Subscribed to iot/devices/+/data');
        }
      });
    });

    this.client.on('message', async (topic: string, payload: Buffer) => {
      try {
        const parts = topic.split('/');
        const mqttDeviceId = parts[2];
        const data = JSON.parse(payload.toString());

        const device = await this.devicesService.findOneOrNull(mqttDeviceId);
        if (!device) {
          this.logger.warn(`Rejected MQTT message: device '${mqttDeviceId}' is not registered`);
          return;
        }

        const reading = await this.devicesService.saveReading(device.id, {
          temperature: data.temperature,
          humidity: data.humidity,
          pressure: data.pressure,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          metadata: data.metadata,
        });

        await this.kafkaService.publishReading({
          deviceId: device.id,
          temperature: reading.temperature,
          humidity: reading.humidity,
          pressure: reading.pressure,
          timestamp: reading.timestamp,
          metadata: reading.metadata,
        });
      } catch (error) {
        this.logger.error(`Error processing MQTT message on topic ${topic}`, error);
      }
    });

    this.client.on('error', (error) => {
      this.logger.error('MQTT client error', error);
    });
  }
}
