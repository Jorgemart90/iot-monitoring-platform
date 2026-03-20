import { ApiProperty } from '@nestjs/swagger';

class UserDto {
  @ApiProperty({ example: '1', description: 'ID del usuario' })
  id: string;

  @ApiProperty({ example: 'admin', description: 'Nombre de usuario' })
  username: string;

  @ApiProperty({ example: 'admin', description: 'Rol del usuario', enum: ['admin', 'viewer'] })
  role: string;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT token. Usar como: Authorization: Bearer <token>',
  })
  access_token: string;

  @ApiProperty({ type: UserDto, description: 'Datos del usuario autenticado' })
  user: UserDto;
}
