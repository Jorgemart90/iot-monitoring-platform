import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios client before importing auth API
vi.mock('./client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import apiClient from './client';
import { authApi } from './auth.api';

const mockedPost = vi.mocked(apiClient.post);
const mockedGet = vi.mocked(apiClient.get);

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login calls POST /auth/login with credentials', async () => {
    mockedPost.mockResolvedValue({ data: { access_token: 'tok', user: {} } });

    await authApi.login({ email: 'a@b.com', password: '12345678' });

    expect(mockedPost).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com',
      password: '12345678',
    });
  });

  it('register calls POST /auth/register', async () => {
    mockedPost.mockResolvedValue({ data: { message: 'ok' } });

    await authApi.register({ name: 'Test', email: 'a@b.com', password: '12345678' });

    expect(mockedPost).toHaveBeenCalledWith('/auth/register', {
      name: 'Test',
      email: 'a@b.com',
      password: '12345678',
    });
  });

  it('verifyEmail calls GET /auth/verify-email with token param', async () => {
    mockedGet.mockResolvedValue({ data: { message: 'verified' } });

    await authApi.verifyEmail('my-token');

    expect(mockedGet).toHaveBeenCalledWith('/auth/verify-email?token=my-token');
  });
});
