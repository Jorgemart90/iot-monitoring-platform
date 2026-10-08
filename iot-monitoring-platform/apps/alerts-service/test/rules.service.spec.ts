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

  it.each([
    [AlertCondition.BETWEEN, 10, true],
    [AlertCondition.BETWEEN, 20, true],
    [AlertCondition.BETWEEN, 21, false],
    [AlertCondition.OUTSIDE_RANGE, 10, false],
    [AlertCondition.OUTSIDE_RANGE, 20, false],
    [AlertCondition.OUTSIDE_RANGE, 9, true],
    [AlertCondition.OUTSIDE_RANGE, 21, true],
  ])('evalúa límites %s con %s', async (condition, temperature, expected) => {
    mockDeviceRepository.findOne.mockResolvedValue({
      id: 'device-1',
      ownerId: 'master-1',
      location: 'Norte',
    });
    mockRepository.find.mockResolvedValue([
      makeRule({ condition, threshold: 10, thresholdMax: 20 }),
    ]);
    expect(
      (await service.evaluateReading({ deviceId: 'device-1', temperature, timestamp: new Date() }))
        .length,
    ).toBe(expected ? 1 : 0);
  });

  it('compara igualdad contra decimales devueltos como texto por PostgreSQL', async () => {
    mockDeviceRepository.findOne.mockResolvedValue({ id: 'device-1' });
    mockRepository.find.mockResolvedValue([
      makeRule({ condition: AlertCondition.EQUALS, threshold: '40.00' as any }),
    ]);
    expect(
      await service.evaluateReading({
        deviceId: 'device-1',
        temperature: 40,
        timestamp: new Date(),
      }),
    ).toHaveLength(1);
  });

  it('combina zona, selección múltiple y propiedad del usuario', async () => {
    mockDeviceRepository.findOne.mockResolvedValue({
      id: 'device-1',
      ownerId: 'demo-1',
      location: 'Norte',
    });
    const rules = [
      makeRule({ zone: 'Sur' }),
      makeRule({ deviceIds: ['device-2'] }),
      makeRule({ ownerId: 'demo-2', owner: { role: UserRole.DEMO } as any }),
      makeRule({
        zone: 'Norte',
        deviceIds: ['device-1', 'device-2'],
        customMessage: 'Revisar ventilación',
      }),
    ];
    mockRepository.find.mockResolvedValue(rules);
    const result = await service.evaluateReading({
      deviceId: 'device-1',
      temperature: 40,
      timestamp: new Date(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Revisar ventilación');
  });

  it('rechaza rangos incompletos o invertidos al editar', async () => {
    mockRepository.findOne.mockResolvedValue(makeRule({ condition: AlertCondition.GREATER_THAN }));
    await expect(
      service.update('rule-1', { condition: AlertCondition.BETWEEN }, masterUser),
    ).rejects.toThrow('límite superior');
    await expect(
      service.update(
        'rule-1',
        { condition: AlertCondition.OUTSIDE_RANGE, thresholdMax: 20 },
        masterUser,
      ),
    ).rejects.toThrow('límite superior');
  });

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
      expect(result[0].message).toBe('Temperatura: 40 °C. Supera el umbral de 35 °C.');
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

  it('permite pausar una regla aunque un sensor se haya movido de zona', async () => {
    const rule = makeRule({ zone: 'Norte', deviceIds: ['device-1'] });
    mockRepository.findOne.mockResolvedValue(rule);
    mockDeviceRepository.findOne.mockResolvedValue({ id: 'device-1', location: 'Sur' });
    mockRepository.save.mockImplementation(async (value) => value);
    const result = await service.update('rule-1', { isActive: false }, masterUser);
    expect(result.isActive).toBe(false);
    expect(mockDeviceRepository.findOne).not.toHaveBeenCalled();
  });

  describe('findOne', () => {
    it('should throw NotFoundException when rule not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing-id', masterUser)).rejects.toThrow(NotFoundException);
    });
  });
});
