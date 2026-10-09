import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HitoProyecto } from './hito-proyecto.entity.js';
import { HitosService } from './hitos.service.js';
import { HitosController } from './hitos.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([HitoProyecto])],
  controllers: [HitosController],
  providers: [HitosService],
})
export class HitosModule {}
