import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DevicesService } from '../src/devices/devices.service';
import { Device, DeviceReading, DeviceType, DeviceStatus } from '@app/database';

const mockDevice: Device = {
  id: 'uuid-1',
  name: 'Test Sensor',
  type: DeviceType.MULTI_SENSOR,
  status: DeviceStatus.ACTIVE,
  location: 'Lab A',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  readings: [],
};

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  remove: jest.fn(),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue({
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn().mockResolvedValue(mockDevice),
    },
  }),
};

describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: getRepositoryToken(Device), useValue: mockRepository },
        { provide: getRepositoryToken(DeviceReading), useValue: mockRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a device successfully', async () => {
      mockRepository.findOne.mockResolvedValue(null); // no conflict
      mockRepository.create.mockReturnValue(mockDevice);
      const result = await service.create({ name: 'Test Sensor', type: DeviceType.MULTI_SENSOR });
      expect(result).toEqual(mockDevice);
    });

    it('should throw ConflictException if name already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockDevice); // conflict!
      await expect(
        service.create({ name: 'Test Sensor', type: DeviceType.MULTI_SENSOR }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated devices', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockDevice], 1]);
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a device by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockDevice);
      const result = await service.findOne('uuid-1');
      expect(result).toEqual(mockDevice);
    });

    it('should throw NotFoundException when device not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a device', async () => {
      const updated = { ...mockDevice, name: 'Updated' };
      mockRepository.findOne.mockResolvedValueOnce(mockDevice); // findOne in findOne()
      mockRepository.findOne.mockResolvedValueOnce(null);       // duplicate check
      mockRepository.save.mockResolvedValue(updated);
      const result = await service.update('uuid-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw ConflictException on duplicate name during update', async () => {
      const other = { ...mockDevice, id: 'uuid-2', name: 'Existing' };
      mockRepository.findOne.mockResolvedValueOnce(mockDevice); // findOne
      mockRepository.findOne.mockResolvedValueOnce(other);      // duplicate check
      await expect(service.update('uuid-1', { name: 'Existing' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove a device', async () => {
      mockRepository.findOne.mockResolvedValue(mockDevice);
      mockRepository.remove.mockResolvedValue(undefined);
      await expect(service.remove('uuid-1')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when removing nonexistent device', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
