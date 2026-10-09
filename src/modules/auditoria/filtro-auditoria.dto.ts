import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../../common/dto/paginacion.dto.js';
import { EsFecha } from '../../common/validacion/es-fecha.decorator.js';
import { AccionAuditoria } from './registro-auditoria.entity.js';

export class FiltroAuditoriaDto extends PaginacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  entidadId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  usuarioId?: number;

  @IsOptional()
  @IsEnum(AccionAuditoria)
  accion?: AccionAuditoria;

  @IsOptional()
  @EsFecha()
  desde?: string;

  @IsOptional()
  @EsFecha()
  hasta?: string;
}
