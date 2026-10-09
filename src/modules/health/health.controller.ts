import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Publico } from '../../common/decorators/publico.decorator.js';

@Controller('health')
@Publico()
@SkipThrottle()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async verificar(): Promise<{ estado: 'ok'; baseDatos: 'ok' }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Base de datos no disponible');
    }
    return { estado: 'ok', baseDatos: 'ok' };
  }
}
