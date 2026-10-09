import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitacoraAdjunto, BitacoraEntrada } from './bitacora.entity.js';
import { BitacoraService } from './bitacora.service.js';
import { BitacoraController } from './bitacora.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([BitacoraEntrada, BitacoraAdjunto])],
  controllers: [BitacoraController],
  providers: [BitacoraService],
})
export class BitacoraModule {}
