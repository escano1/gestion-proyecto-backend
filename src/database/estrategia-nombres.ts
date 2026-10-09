import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

const aSnake = (texto: string): string =>
  texto.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** Columnas en snake_case en PostgreSQL manteniendo camelCase en TypeScript. */
export class EstrategiaNombresSnake
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override tableName(nombreClase: string, nombreDefinido: string | undefined): string {
    return nombreDefinido ?? aSnake(nombreClase);
  }

  override columnName(
    propiedad: string,
    nombreDefinido: string | undefined,
    prefijos: string[],
  ): string {
    return aSnake([...prefijos, nombreDefinido ?? propiedad].join('_'));
  }

  override relationName(propiedad: string): string {
    return aSnake(propiedad);
  }

  override joinColumnName(relacion: string, columnaReferenciada: string): string {
    return aSnake(`${relacion}_${columnaReferenciada}`);
  }

  override joinTableColumnName(
    tabla: string,
    propiedad: string,
    columna?: string,
  ): string {
    return aSnake(`${tabla}_${columna ?? propiedad}`);
  }
}
