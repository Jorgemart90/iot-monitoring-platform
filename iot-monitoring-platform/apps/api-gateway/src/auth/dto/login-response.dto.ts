import { ApiProperty } from '@nestjs/swagger';

class UserDto {
  @ApiProperty({ example: '1', description: 'ID del usuario' })
  id: string;

  @ApiProperty({ example: 'admin', description: 'Nombre de usuario' })
  username: string;

  @ApiProperty({ example: 'Platform Administrator' })
  name: string;

  @ApiProperty({
    example: 'MASTER',
    description: 'Rol del usuario',
    enum: ['MASTER', 'DEMO'],
  })
  role: string;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT token. Usar como: Authorization: Bearer <token>',
  })
  access_token: string;

  @ApiProperty({
    example: 900,
    description: 'Duración del access token en segundos',
  })
  expires_in: number;

  @ApiProperty({ type: UserDto, description: 'Datos del usuario autenticado' })
  user: UserDto;
}
