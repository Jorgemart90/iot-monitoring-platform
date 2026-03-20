import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Device, DeviceReading } from '@app/database';
import { PaginationDto } from '@app/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(DeviceReading)
    private readonly readingRepository: Repository<DeviceReading>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDeviceDto: CreateDeviceDto): Promise<Device> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const device = this.deviceRepository.create(createDeviceDto);
      const saved = await queryRunner.manager.save(device);
      await queryRunner.commitTransaction();
      this.logger.log(`Device created: ${saved.id}`);
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.deviceRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneOrNull(id: string): Promise<Device | null> {
    return this.deviceRepository.findOne({ where: { id } });
  }

  async findOne(id: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException(`Device with id ${id} not found`);
    }
    return device;
  }

  async update(id: string, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
    const device = await this.findOne(id);
    Object.assign(device, updateDeviceDto);
    return this.deviceRepository.save(device);
  }

  async remove(id: string): Promise<void> {
    const device = await this.findOne(id);
    await this.deviceRepository.remove(device);
    this.logger.log(`Device removed: ${id}`);
  }

  async saveReading(
    deviceId: string,
    readingData: {
      temperature?: number;
      humidity?: number;
      pressure?: number;
      timestamp?: Date;
      metadata?: Record<string, any>;
    },
  ): Promise<DeviceReading> {
    const device = await this.findOne(deviceId);
    const reading = this.readingRepository.create({
      deviceId: device.id,
      temperature: readingData.temperature,
      humidity: readingData.humidity,
      pressure: readingData.pressure,
      timestamp: readingData.timestamp || new Date(),
      metadata: readingData.metadata,
    });
    return this.readingRepository.save(reading);
  }
}
