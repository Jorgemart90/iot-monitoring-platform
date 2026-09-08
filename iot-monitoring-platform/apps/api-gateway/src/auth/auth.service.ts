import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '@app/database';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese correo electrónico');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);

    const user = this.userRepository.create({
      email: registerDto.email,
      name: registerDto.name,
      passwordHash,
      role: UserRole.VIEWER,
      isVerified: false,
      verificationToken,
      verificationTokenExpiry: expiry,
    });

    await this.userRepository.save(user);

    await this.mailService.sendVerificationEmail(
      registerDto.email,
      registerDto.name,
      verificationToken,
    );

    this.logger.log(`New user registered: ${registerDto.email}`);
    return { message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta.' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Token de verificación inválido');
    }

    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      throw new BadRequestException('El token de verificación ha expirado');
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    await this.userRepository.save(user);

    this.logger.log(`Email verified: ${user.email}`);
    return { message: 'Correo verificado exitosamente. Ya puedes iniciar sesión.' };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Debes verificar tu correo electrónico antes de iniciar sesión');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // Bootstrap: solo funciona si no existe ningún usuario. Crea el primer admin sin verificación.
  async setupAdmin(registerDto: RegisterDto): Promise<{ message: string }> {
    const count = await this.userRepository.count();
    if (count > 0) {
      throw new ForbiddenException('El setup ya fue realizado. Este endpoint está deshabilitado.');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const user = this.userRepository.create({
      email: registerDto.email,
      name: registerDto.name,
      passwordHash,
      role: UserRole.ADMIN,
      isVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
    });

    await this.userRepository.save(user);
    this.logger.log(`First admin created: ${registerDto.email}`);
    return { message: `Admin creado exitosamente. Ya puedes iniciar sesión con ${registerDto.email}` };
  }
}
