import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HerramientaProyecto } from './herramienta-proyecto.entity.js';
import { HerramientasService } from './herramientas.service.js';
import { HerramientasController } from './herramientas.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([HerramientaProyecto])],
  controllers: [HerramientasController],
  providers: [HerramientasService],
})
export class HerramientasModule {}
