import { Controller, Get, Query } from '@nestjs/common';
import { TiposHoraService } from './tipos-hora.service.js';
import { FechaOpcionalDto } from '../parametros/parametros.dto.js';

@Controller('tipos-hora')
export class TiposHoraController {
  constructor(private readonly tiposHora: TiposHoraService) {}

  @Get()
  listar(@Query() { fecha }: FechaOpcionalDto) {
    return this.tiposHora.listar(fecha);
  }
}
