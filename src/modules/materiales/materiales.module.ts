import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialProyecto } from './material-proyecto.entity.js';
import { MaterialesService } from './materiales.service.js';
import { MaterialesController } from './materiales.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([MaterialProyecto])],
  controllers: [MaterialesController],
  providers: [MaterialesService],
})
export class MaterialesModule {}
