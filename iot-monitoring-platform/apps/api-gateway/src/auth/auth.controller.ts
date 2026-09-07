import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public } from '@app/common';
import { AuthResult, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

const REFRESH_COOKIE = 'iot_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión como usuario master' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(loginDto, this.clientInfo(request));
    this.setRefreshCookie(response, result.refreshToken);
    return this.toResponse(result);
  }

  @Public()
  @Post('demo')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear una sesión temporal y limitada para la demo',
  })
  async demo(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.loginAsDemo(this.clientInfo(request));
    this.setRefreshCookie(response, result.refreshToken);
    return this.toResponse(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotar la sesión y emitir un nuevo access token' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.refresh(
      this.readCookie(request, REFRESH_COOKIE),
      this.clientInfo(request),
    );
    this.setRefreshCookie(response, result.refreshToken);
    return this.toResponse(result);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(user.sessionId);
    response.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.authService.listSessions(user);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.authService.revokeSession(user, id);
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Number(process.env.SESSION_EXPIRATION ?? 86400) * 1000,
    });
  }

  private readCookie(request: Request, name: string): string | undefined {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.substring(name.length + 1)) : undefined;
  }

  private clientInfo(request: Request) {
    return { userAgent: request.headers['user-agent'], ipAddress: request.ip };
  }

  private toResponse(result: AuthResult): LoginResponseDto {
    return {
      access_token: result.access_token,
      expires_in: result.expires_in,
      user: result.user,
    };
  }
}
