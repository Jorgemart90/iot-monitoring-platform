import { Controller, Post, Body, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario registrado, correo de verificación enviado' })
  @ApiResponse({ status: 409, description: 'El correo ya está en uso' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verificar correo electrónico con token' })
  @ApiQuery({ name: 'token', type: String })
  @ApiResponse({ status: 200, description: 'Correo verificado exitosamente' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('setup-admin')
  @ApiOperation({
    summary: 'Crear primer admin (solo funciona si no hay usuarios)',
    description: 'Endpoint de bootstrap. Se desactiva automáticamente una vez que existe al menos un usuario.',
  })
  @ApiResponse({ status: 201, description: 'Admin creado exitosamente' })
  @ApiResponse({ status: 403, description: 'Ya existe al menos un usuario en el sistema' })
  setupAdmin(@Body() registerDto: RegisterDto) {
    return this.authService.setupAdmin(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener JWT' })
  @ApiResponse({ status: 200, description: 'Login exitoso, retorna access_token y datos del usuario' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas o correo no verificado' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
