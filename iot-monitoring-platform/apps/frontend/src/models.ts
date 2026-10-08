export interface User {
  id: string;
  username: string;
  name: string;
  role: 'MASTER' | 'DEMO';
  status?: string;
  expiresAt?: string;
}
export interface Device {
  id: string;
  name: string;
  type: string;
  location?: string;
  ownerId: string;
  lastSeenAt?: string;
  metadata?: Record<string, unknown>;
}
export interface Rule {
  ownerId: string;
  id: string;
  name: string;
  deviceId?: string;
  metricField: string;
  condition: string;
  threshold: number;
  thresholdMax?: number;
  zone?: string | null;
  deviceIds?: string[] | null;
  customMessage?: string;
  color?: string;
  severity: string;
  isActive: boolean;
}
export interface Alert {
  id: string;
  ruleId: string;
  deviceId: string;
  severity: string;
  status: string;
  triggeredValue: number;
  message?: string;
  metadata?: { color?: string; zone?: string };
  triggeredAt: string;
  rule?: Rule;
}
export interface Session {
  id: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}
export interface Reading {
  temperature: number;
  humidity: number;
  timestamp: string;
}
export interface Metric {
  value: number;
  min: number;
  max: number;
  avg: number;
  count: number;
}
export interface AuthResult {
  access_token: string;
  expires_in: number;
  user: User;
}
export interface AlertSummary {
  total: number;
  bySeverity: Record<string, number>;
}
export interface Data {
  alertSummary: AlertSummary;
  devices: Device[];
  rules: Rule[];
  alerts: Alert[];
  sessions: Session[];
  users: User[];
  metrics: Record<string, Metric>;
  readings: Reading[];
}
