import apiClient from './client';
import type { Device, PaginatedResponse } from '@/types';
import { DeviceStatus } from '@/types';

export interface CreateDeviceRequest {
  name: string;
  type: string;
  location: string;
  status?: DeviceStatus;
  mqttTopic: string;
  metadata?: Record<string, unknown>;
}

export type UpdateDeviceRequest = Partial<CreateDeviceRequest>;

export const devicesApi = {
  findAll: (page = 1, limit = 10) =>
    apiClient.get<PaginatedResponse<Device>>('/devices', {
      params: { page, limit },
    }),

  findOne: (id: string) =>
    apiClient.get<Device>(`/devices/${id}`),

  create: (data: CreateDeviceRequest) =>
    apiClient.post<Device>('/devices', data),

  update: (id: string, data: UpdateDeviceRequest) =>
    apiClient.patch<Device>(`/devices/${id}`, data),

  remove: (id: string) =>
    apiClient.delete(`/devices/${id}`),
};
