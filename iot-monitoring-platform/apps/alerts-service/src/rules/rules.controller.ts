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
import { RulesService } from './rules.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { AuthUser, CurrentUser, PaginationDto } from '@app/common';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva regla de alerta' })
  @ApiResponse({ status: 201, description: 'Regla creada exitosamente' })
  create(@Body() createRuleDto: CreateRuleDto, @CurrentUser() user: AuthUser) {
    return this.rulesService.create(createRuleDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar reglas de alertas (paginado)' })
  findAll(@Query() paginationDto: PaginationDto, @CurrentUser() user: AuthUser) {
    return this.rulesService.findAll(paginationDto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener regla por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.rulesService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar regla de alerta' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRuleDto: UpdateRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rulesService.update(id, updateRuleDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar regla de alerta' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.rulesService.remove(id, user);
  }
}
