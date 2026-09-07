import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import { Session, User, UserRole, UserStatus } from '@app/database';
import { AuthUser } from '@app/common';
import { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from './password.util';

interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  access_token: string;
  expires_in: number;
  refreshToken: string;
  user: { id: string; username: string; name: string; role: UserRole };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly accessTokenSeconds: number;
  private readonly sessionSeconds: number;
  private readonly demoAttempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {
    this.accessTokenSeconds = Number(this.configService.get('JWT_ACCESS_EXPIRATION', 900));
    this.sessionSeconds = Number(this.configService.get('SESSION_EXPIRATION', 86400));
  }

  async onModuleInit(): Promise<void> {
    await this.removeExpiredDemoUsers();
    await this.ensureMasterUser();
    const cleanup = setInterval(() => this.removeExpiredDemoUsers(), 60 * 60 * 1000);
    cleanup.unref();
  }

  async login(loginDto: LoginDto, client: ClientInfo): Promise<AuthResult> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username: loginDto.username })
      .getOne();

    if (!user?.passwordHash || !(await verifyPassword(loginDto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    this.assertUserCanLogin(user);
    return this.createSession(user, client);
  }

  async loginAsDemo(client: ClientInfo): Promise<AuthResult> {
    this.assertDemoRateLimit(client.ipAddress ?? 'unknown');
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    const now = new Date();
    const user = await this.userRepository.save(
      this.userRepository.create({
        username: `demo-${suffix}`,
        name: `Visitante Demo ${suffix}`,
        passwordHash: null,
        role: UserRole.DEMO,
        status: UserStatus.ACTIVE,
        expiresAt: new Date(now.getTime() + this.sessionSeconds * 1000),
        lastLoginAt: now,
      }),
    );
    return this.createSession(user, client);
  }

  async refresh(refreshToken: string | undefined, client: ClientInfo): Promise<AuthResult> {
    if (!refreshToken) throw new UnauthorizedException('Refresh token requerido');
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepository
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .leftJoinAndSelect('session.user', 'user')
      .where('session.refreshTokenHash = :tokenHash', { tokenHash })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > :now', { now: new Date() })
      .getOne();

    if (!session) throw new UnauthorizedException('Sesión inválida o expirada');
    this.assertUserCanLogin(session.user);

    const nextRefreshToken = randomBytes(48).toString('base64url');
    session.refreshTokenHash = this.hashToken(nextRefreshToken);
    session.lastUsedAt = new Date();
    session.userAgent = client.userAgent ?? session.userAgent;
    session.ipAddress = client.ipAddress ?? session.ipAddress;
    await this.sessionRepository.save(session);

    return this.buildResult(session.user, session.id, nextRefreshToken);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepository.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async listSessions(user: AuthUser) {
    return this.sessionRepository.find({
      where: { userId: user.userId },
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        userId: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  async revokeSession(user: AuthUser, sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId: user.userId },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    session.revokedAt = new Date();
    await this.sessionRepository.save(session);
  }

  private async ensureMasterUser(): Promise<void> {
    const username = this.configService.get<string>('MASTER_USERNAME');
    const password = this.configService.get<string>('MASTER_PASSWORD');
    if (!username || !password) {
      throw new Error('MASTER_USERNAME y MASTER_PASSWORD son obligatorios');
    }
    const exists = await this.userRepository.findOne({
      where: { role: UserRole.MASTER },
    });
    if (exists) return;
    await this.userRepository.save(
      this.userRepository.create({
        username,
        name: this.configService.get<string>('MASTER_NAME', 'Platform Administrator'),
        passwordHash: await hashPassword(password),
        role: UserRole.MASTER,
        status: UserStatus.ACTIVE,
        expiresAt: null,
        lastLoginAt: null,
      }),
    );
  }

  private async createSession(user: User, client: ClientInfo): Promise<AuthResult> {
    const now = new Date();
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.sessionRepository.save(
      this.sessionRepository.create({
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        userAgent: client.userAgent ?? null,
        ipAddress: client.ipAddress ?? null,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + this.sessionSeconds * 1000),
        revokedAt: null,
      }),
    );
    user.lastLoginAt = now;
    await this.userRepository.save(user);
    return this.buildResult(user, session.id, refreshToken);
  }

  private async buildResult(
    user: User,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthResult> {
    const access_token = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        sid: sessionId,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        algorithm: 'HS256',
        issuer: this.configService.get<string>('JWT_ISSUER', 'iot-monitoring-api'),
        audience: this.configService.get<string>('JWT_AUDIENCE', 'iot-monitoring-demo'),
        expiresIn: this.accessTokenSeconds,
      },
    );
    return {
      access_token,
      expires_in: this.accessTokenSeconds,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  }

  private assertUserCanLogin(user: User): void {
    if (user.status !== UserStatus.ACTIVE || (user.expiresAt && user.expiresAt <= new Date())) {
      throw new UnauthorizedException('Usuario deshabilitado o expirado');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertDemoRateLimit(key: string): void {
    const now = Date.now();
    const current = this.demoAttempts.get(key);
    if (!current || current.resetAt <= now) {
      this.demoAttempts.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
      return;
    }
    if (current.count >= 10) {
      throw new HttpException(
        'Límite de sesiones demo alcanzado. Intenta más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    current.count += 1;
  }

  private async removeExpiredDemoUsers(): Promise<void> {
    await this.userRepository.delete({
      role: UserRole.DEMO,
      expiresAt: LessThan(new Date()),
    });
  }
}
