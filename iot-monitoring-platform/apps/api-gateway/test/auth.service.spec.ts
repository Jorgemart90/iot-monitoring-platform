import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';
import { User, UserRole } from '@app/database';
import { MailService } from '../src/mail/mail.service';

const mockUser: User = {
  id: 'user-uuid',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: bcrypt.hashSync('password123', 1),
  role: UserRole.VIEWER,
  isVerified: true,
  verificationToken: null,
  verificationTokenExpiry: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

const mockMailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should register a new user and send verification email', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({ ...mockUser, isVerified: false });
      mockRepository.save.mockResolvedValue({ ...mockUser, isVerified: false });

      const result = await service.register({
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      });

      expect(result.message).toContain('Revisa tu correo');
      expect(mockMailService.sendVerificationEmail).toHaveBeenCalledWith(
        'new@example.com',
        'New User',
        expect.any(String),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'test@example.com', name: 'Test', password: 'pass1234' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── verifyEmail ─────────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const future = new Date(Date.now() + 3600_000);
      const unverified = {
        ...mockUser,
        isVerified: false,
        verificationToken: 'valid-token',
        verificationTokenExpiry: future,
      };
      mockRepository.findOne.mockResolvedValue(unverified);
      mockRepository.save.mockResolvedValue({ ...unverified, isVerified: true });

      const result = await service.verifyEmail('valid-token');
      expect(result.message).toContain('verificado');
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      const past = new Date(Date.now() - 3600_000);
      mockRepository.findOne.mockResolvedValue({
        ...mockUser,
        verificationToken: 'expired-token',
        verificationTokenExpiry: past,
      });
      await expect(service.verifyEmail('expired-token')).rejects.toThrow(BadRequestException);
    });
  });

  // ── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should return access_token for valid credentials', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'unknown@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      await expect(
        service.login({ email: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockUser, isVerified: false });
      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── setupAdmin ──────────────────────────────────────────────────────────────

  describe('setupAdmin', () => {
    it('should create admin when no users exist', async () => {
      mockRepository.count.mockResolvedValue(0);
      mockRepository.create.mockReturnValue({ ...mockUser, role: UserRole.ADMIN });
      mockRepository.save.mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });

      const result = await service.setupAdmin({
        email: 'admin@example.com',
        name: 'Admin',
        password: 'admin1234',
      });

      expect(result.message).toContain('admin@example.com');
    });

    it('should throw ForbiddenException if users already exist', async () => {
      mockRepository.count.mockResolvedValue(1);
      await expect(
        service.setupAdmin({ email: 'admin@example.com', name: 'Admin', password: 'admin1234' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
