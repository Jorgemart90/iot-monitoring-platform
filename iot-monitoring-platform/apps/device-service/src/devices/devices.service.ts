import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Device, DeviceReading, UserRole } from '@app/database';
import { AuthUser, PaginationDto } from '@app/common';
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

  async create(createDeviceDto: CreateDeviceDto, user: AuthUser): Promise<Device> {
    if (user.role === UserRole.DEMO) {
      const ownedDevices = await this.deviceRepository.count({
        where: { ownerId: user.userId },
      });
      if (ownedDevices >= 3) {
        throw new ForbiddenException('Los usuarios demo pueden registrar máximo 3 dispositivos');
      }
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const device = this.deviceRepository.create({
        ...createDeviceDto,
        ownerId: user.userId,
        isDemo: user.role === UserRole.DEMO,
      });
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

  async findAll(paginationDto: PaginationDto, user: AuthUser) {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.deviceRepository.findAndCount({
      where: user.role === UserRole.MASTER ? {} : { ownerId: user.userId },
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

  async findOne(id: string, user: AuthUser): Promise<Device> {
    const where = user.role === UserRole.MASTER ? { id } : { id, ownerId: user.userId };
    const device = await this.deviceRepository.findOne({ where });
    if (!device) {
      throw new NotFoundException(`Device with id ${id} not found`);
    }
    return device;
  }

  async update(id: string, updateDeviceDto: UpdateDeviceDto, user: AuthUser): Promise<Device> {
    const device = await this.findOne(id, user);
    Object.assign(device, updateDeviceDto);
    return this.deviceRepository.save(device);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const device = await this.findOne(id, user);
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
    const device = await this.findOneOrNull(deviceId);
    if (!device) {
      throw new NotFoundException(`Device with id ${deviceId} not found`);
    }
    const reading = this.readingRepository.create({
      deviceId: device.id,
      temperature: readingData.temperature,
      humidity: readingData.humidity,
      pressure: readingData.pressure,
      timestamp: readingData.timestamp || new Date(),
      metadata: readingData.metadata,
    });
    device.lastSeenAt = readingData.timestamp || new Date();
    await this.deviceRepository.save(device);
    return this.readingRepository.save(reading);
  }
}
