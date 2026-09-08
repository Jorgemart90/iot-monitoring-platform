import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AlertsService } from '../src/alerts/alerts.service';
import { Alert, AlertStatus, AlertSeverity } from '@app/database';

const makeAlert = (status: AlertStatus): Alert => ({
  id: 'alert-1',
  ruleId: 'rule-1',
  deviceId: 'device-1',
  message: 'Temperature exceeded threshold',
  severity: AlertSeverity.HIGH,
  status,
  triggeredValue: 42,
  metadata: null,
  triggeredAt: new Date(),
  acknowledgedAt: null,
  resolvedAt: null,
  rule: null,
});

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
};

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(Alert), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should return paginated alerts', async () => {
      const alert = makeAlert(AlertStatus.TRIGGERED);
      mockRepository.findAndCount.mockResolvedValue([[alert], 1]);

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return an alert by id', async () => {
      const alert = makeAlert(AlertStatus.TRIGGERED);
      mockRepository.findOne.mockResolvedValue(alert);

      const result = await service.findOne('alert-1');
      expect(result.id).toBe('alert-1');
    });

    it('should throw NotFoundException if alert not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('acknowledge', () => {
    it('should set status to ACKNOWLEDGED and set acknowledgedAt', async () => {
      const alert = makeAlert(AlertStatus.TRIGGERED);
      mockRepository.findOne.mockResolvedValue(alert);
      mockRepository.save.mockImplementation((a: Alert) => Promise.resolve(a));

      const result = await service.acknowledge('alert-1');
      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(result.acknowledgedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException for unknown alert', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.acknowledge('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolve', () => {
    it('should set status to RESOLVED and set resolvedAt', async () => {
      const alert = makeAlert(AlertStatus.ACKNOWLEDGED);
      mockRepository.findOne.mockResolvedValue(alert);
      mockRepository.save.mockImplementation((a: Alert) => Promise.resolve(a));

      const result = await service.resolve('alert-1');
      expect(result.status).toBe(AlertStatus.RESOLVED);
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });
  });
});
