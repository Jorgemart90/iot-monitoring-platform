import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('IoT Monitoring Platform - API Gateway')
  .setDescription('API Gateway para el sistema de monitoreo IoT. Centraliza autenticación, documentación y enrutamiento.')
  .setVersion('1.0')
  .addTag('auth', 'Autenticación y autorización')
  .addTag('health', 'Estado del servicio')
  .addBearerAuth()
  .build();
