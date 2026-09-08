import apiClient from './client';
import type { Alert, AlertRule, PaginatedResponse } from '@/types';
import { AlertSeverity, RuleCondition } from '@/types';

export interface CreateRuleRequest {
  name: string;
  deviceId?: string;
  metricField: string;
  condition: RuleCondition;
  threshold: number;
  thresholdMax?: number;
  severity: AlertSeverity;
  isActive?: boolean;
}

export type UpdateRuleRequest = Partial<CreateRuleRequest>;

export const alertRulesApi = {
  findAll: (page = 1, limit = 10) =>
    apiClient.get<PaginatedResponse<AlertRule>>('/rules', {
      params: { page, limit },
    }),

  findOne: (id: string) =>
    apiClient.get<AlertRule>(`/rules/${id}`),

  create: (data: CreateRuleRequest) =>
    apiClient.post<AlertRule>('/rules', data),

  update: (id: string, data: UpdateRuleRequest) =>
    apiClient.patch<AlertRule>(`/rules/${id}`, data),

  remove: (id: string) =>
    apiClient.delete(`/rules/${id}`),
};

export const alertsApi = {
  findAll: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<Alert>>('/alerts', {
      params: { page, limit },
    }),

  acknowledge: (id: string) =>
    apiClient.patch<Alert>(`/alerts/${id}/acknowledge`),

  resolve: (id: string) =>
    apiClient.patch<Alert>(`/alerts/${id}/resolve`),
};
