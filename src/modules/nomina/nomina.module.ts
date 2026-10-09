import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoHora } from '../tipos-hora/tipo-hora.entity.js';
import { Trabajador } from '../trabajadores/trabajador.entity.js';
import { NominaController } from './nomina.controller.js';
import {
  ConceptoNomina,
  LiquidacionNomina,
  NominaTrabajador,
} from './nomina.entity.js';
import { NominaService } from './nomina.service.js';

// ParametrosService, AuditoriaService y ConfigService vienen de módulos globales.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      LiquidacionNomina,
      NominaTrabajador,
      ConceptoNomina,
      Trabajador,
      TipoHora,
    ]),
  ],
  controllers: [NominaController],
  providers: [NominaService],
})
export class NominaModule {}
