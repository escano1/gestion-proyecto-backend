import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoHora } from './tipo-hora.entity.js';
import { TiposHoraService } from './tipos-hora.service.js';
import { TiposHoraController } from './tipos-hora.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([TipoHora])],
  controllers: [TiposHoraController],
  providers: [TiposHoraService],
})
export class TiposHoraModule {}
