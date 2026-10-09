import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Rol } from '../../common/enums/rol.enum.js';
import { AuditoriaService } from './auditoria.service.js';
import { FiltroAuditoriaDto } from './filtro-auditoria.dto.js';

@Controller('auditoria')
@Roles(Rol.ADMIN)
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  listar(@Query() filtro: FiltroAuditoriaDto) {
    return this.auditoria.listar(filtro);
  }
}
