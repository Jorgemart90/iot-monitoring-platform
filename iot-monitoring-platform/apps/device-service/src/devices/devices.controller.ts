import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { AuthUser, CurrentUser, PaginationDto } from '@app/common';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar nuevo dispositivo IoT' })
  @ApiResponse({ status: 201, description: 'Dispositivo creado exitosamente' })
  create(@Body() createDeviceDto: CreateDeviceDto, @CurrentUser() user: AuthUser) {
    return this.devicesService.create(createDeviceDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los dispositivos (paginado)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de dispositivos' })
  findAll(@Query() paginationDto: PaginationDto, @CurrentUser() user: AuthUser) {
    return this.devicesService.findAll(paginationDto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener dispositivo por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Dispositivo encontrado' })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.devicesService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar dispositivo' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Dispositivo actualizado' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.devicesService.update(id, updateDeviceDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar dispositivo' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Dispositivo eliminado' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.devicesService.remove(id, user);
  }
}
