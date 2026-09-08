import apiClient from './client';
import type { DeviceReading, MetricData, PaginatedResponse } from '@/types';

export const analyticsApi = {
  getMetrics: (deviceId: string) =>
    apiClient.get<MetricData[]>(`/analytics/devices/${deviceId}/metrics`),

  getReadings: (deviceId: string, page = 1, limit = 50) =>
    apiClient.get<PaginatedResponse<DeviceReading>>(
      `/analytics/devices/${deviceId}/readings`,
      { params: { page, limit } },
    ),
};
