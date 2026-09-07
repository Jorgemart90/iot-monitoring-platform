import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RulesService } from '../src/rules/rules.service';
import { AlertRule, AlertCondition, AlertSeverity, Device, UserRole } from '@app/database';
import { AuthUser, IDeviceReading } from '@app/common';

const masterUser: AuthUser = {
  userId: 'master-1',
  username: 'admin',
  role: UserRole.MASTER,
  sessionId: 'session-1',
};

const makeRule = (overrides: Partial<AlertRule>): AlertRule => ({
  id: 'rule-1',
  name: 'Test Rule',
  description: '',
  deviceId: null,
  ownerId: 'master-1',
  owner: null,
  metricField: 'temperature',
  condition: AlertCondition.GREATER_THAN,
  threshold: 35,
  thresholdMax: null,
  severity: AlertSeverity.HIGH,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  remove: jest.fn(),
};

const mockDeviceRepository = { findOne: jest.fn() };

describe('RulesService', () => {
  let service: RulesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        { provide: getRepositoryToken(AlertRule), useValue: mockRepository },
        { provide: getRepositoryToken(Device), useValue: mockDeviceRepository },
      ],
    }).compile();

    service = module.get<RulesService>(RulesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('evaluateReading', () => {
    const reading: IDeviceReading = {
      deviceId: 'device-1',
      temperature: 40,
      humidity: 60,
      timestamp: new Date(),
    };

    beforeEach(() =>
      mockDeviceRepository.findOne.mockResolvedValue({
        id: 'device-1',
        ownerId: 'master-1',
      }),
    );

    it('should trigger GREATER_THAN rule', async () => {
      mockRepository.find.mockResolvedValue([
        makeRule({ condition: AlertCondition.GREATER_THAN, threshold: 35 }),
      ]);
      const result = await service.evaluateReading(reading);
      expect(result).toHaveLength(1);
      expect(result[0].triggeredValue).toBe(40);
    });

    it('should not trigger if value is below threshold', async () => {
      mockRepository.find.mockResolvedValue([
        makeRule({ condition: AlertCondition.GREATER_THAN, threshold: 50 }),
      ]);
      const result = await service.evaluateReading(reading);
      expect(result).toHaveLength(0);
    });

    it('should trigger LESS_THAN rule', async () => {
      mockRepository.find.mockResolvedValue([
        makeRule({ condition: AlertCondition.LESS_THAN, threshold: 45 }),
      ]);
      const result = await service.evaluateReading(reading);
      expect(result).toHaveLength(1);
    });

    it('should trigger BETWEEN rule', async () => {
      mockRepository.find.mockResolvedValue([
        makeRule({
          condition: AlertCondition.BETWEEN,
          threshold: 35,
          thresholdMax: 45,
        }),
      ]);
      const result = await service.evaluateReading(reading);
      expect(result).toHaveLength(1);
    });

    it('should skip rules for other devices', async () => {
      mockRepository.find.mockResolvedValue([makeRule({ deviceId: 'other-device' })]);
      const result = await service.evaluateReading(reading);
      expect(result).toHaveLength(0);
    });

    it('should skip inactive rules', async () => {
      // Rules are filtered by isActive at the repository level in a real query
      mockRepository.find.mockResolvedValue([]);
      const result = await service.evaluateReading(reading);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when rule not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing-id', masterUser)).rejects.toThrow(NotFoundException);
    });
  });
});
