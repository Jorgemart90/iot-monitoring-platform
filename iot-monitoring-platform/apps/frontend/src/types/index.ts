export enum UserRole {
  ADMIN = 'admin',
  VIEWER = 'viewer',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export enum DeviceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

export interface Device {
  id: string;
  name: string;
  type: string;
  location: string;
  status: DeviceStatus;
  mqttTopic: string;
  metadata?: Record<string, unknown>;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceReading {
  id: string;
  deviceId: string;
  metricType: string;
  value: number;
  unit: string;
  timestamp: string;
  rawPayload?: Record<string, unknown>;
}

export enum RuleCondition {
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  EQUALS = 'EQUALS',
  BETWEEN = 'BETWEEN',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  deviceId?: string;
  metricField: string;
  condition: RuleCondition;
  threshold: number;
  thresholdMax?: number;
  severity: AlertSeverity;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  deviceId: string;
  deviceName: string;
  metricField: string;
  triggerValue: number;
  threshold: number;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MetricData {
  field: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  lastValue: number;
  lastUpdated: string;
  unit: string;
}
