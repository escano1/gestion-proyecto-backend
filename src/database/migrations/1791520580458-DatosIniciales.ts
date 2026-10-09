import type { MigrationInterface, QueryRunner } from 'typeorm';

const TIPOS_HORA: [
  number,
  string,
  string,
  boolean,
  boolean,
  boolean,
  string,
][] = [
  [
    1,
    'ORD',
    'Hora ordinaria diurna',
    false,
    false,
    false,
    'Dentro de la jornada, de 6:00 a.m. a 7:00 p.m.',
  ],
  [
    2,
    'NOC',
    'Hora ordinaria nocturna',
    false,
    true,
    false,
    'Dentro de la jornada, de 7:00 p.m. a 6:00 a.m. (Ley 2466 de 2025)',
  ],
  [
    3,
    'HED',
    'Hora extra diurna',
    true,
    false,
    false,
    'Por fuera de la jornada, horario diurno',
  ],
  [
    4,
    'HEN',
    'Hora extra nocturna',
    true,
    true,
    false,
    'Por fuera de la jornada, horario nocturno',
  ],
  [
    5,
    'DOM',
    'Hora dominical/festiva diurna',
    false,
    false,
    true,
    'Dentro de la jornada en domingo o festivo, horario diurno',
  ],
  [
    6,
    'DOMN',
    'Hora dominical/festiva nocturna',
    false,
    true,
    true,
    'Dentro de la jornada en domingo o festivo, horario nocturno',
  ],
  [
    7,
    'HEDD',
    'Hora extra dominical/festiva diurna',
    true,
    false,
    true,
    'Extra en domingo o festivo, horario diurno',
  ],
  [
    8,
    'HEDN',
    'Hora extra dominical/festiva nocturna',
    true,
    true,
    true,
    'Extra en domingo o festivo, horario nocturno',
  ],
];

/** [código, valor, vigente desde, norma]. Verificar cada año con la normativa vigente. */
const PARAMETROS: [string, number, string, string][] = [
  ['SMMLV', 1300000, '2024-01-01', 'Decreto 2292 de 2023'],
  ['SMMLV', 1423500, '2025-01-01', 'Decreto 1572 de 2024'],
  ['SMMLV', 1750905, '2026-01-01', 'Decreto 1469 de 2025'],
  ['AUXILIO_TRANSPORTE', 162000, '2024-01-01', 'Decreto 2293 de 2023'],
  ['AUXILIO_TRANSPORTE', 200000, '2025-01-01', 'Decreto 1573 de 2024'],
  ['AUXILIO_TRANSPORTE', 249095, '2026-01-01', 'Decreto 1470 de 2025'],
  ['UVT', 47065, '2024-01-01', 'Resolución DIAN 000187 de 2023'],
  ['UVT', 49799, '2025-01-01', 'Resolución DIAN 000193 de 2024'],
  ['UVT', 52374, '2026-01-01', 'Resolución DIAN 000238 de 2025'],
  ['JORNADA_MAXIMA_SEMANAL', 47, '2023-07-15', 'Ley 2101 de 2021'],
  ['JORNADA_MAXIMA_SEMANAL', 46, '2024-07-15', 'Ley 2101 de 2021'],
  ['JORNADA_MAXIMA_SEMANAL', 44, '2025-07-15', 'Ley 2101 de 2021'],
  ['JORNADA_MAXIMA_SEMANAL', 42, '2026-07-15', 'Ley 2101 de 2021'],
  ['RECARGO_NOCTURNO', 0.35, '2024-01-01', 'Art. 168 C.S.T.'],
  ['RECARGO_EXTRA_DIURNA', 0.25, '2024-01-01', 'Art. 168 C.S.T.'],
  ['RECARGO_EXTRA_NOCTURNA', 0.75, '2024-01-01', 'Art. 168 C.S.T.'],
  ['RECARGO_DOMINICAL_FESTIVO', 0.75, '2024-01-01', 'Art. 179 C.S.T.'],
  ['RECARGO_DOMINICAL_FESTIVO', 0.8, '2025-07-01', 'Ley 2466 de 2025'],
  ['RECARGO_DOMINICAL_FESTIVO', 0.9, '2026-07-01', 'Ley 2466 de 2025'],
  ['RECARGO_DOMINICAL_FESTIVO', 1.0, '2027-07-01', 'Ley 2466 de 2025'],
  ['APORTE_SALUD_EMPLEADO', 0.04, '2024-01-01', 'Ley 1122 de 2007'],
  ['APORTE_PENSION_EMPLEADO', 0.04, '2024-01-01', 'Ley 797 de 2003'],
  ['LIMITE_HORAS_EXTRA_DIA', 2, '2024-01-01', 'Art. 22 Ley 50 de 1990'],
  ['LIMITE_HORAS_EXTRA_SEMANA', 12, '2024-01-01', 'Art. 22 Ley 50 de 1990'],
];

export class DatosIniciales1791520580458 implements MigrationInterface {
  name = 'DatosIniciales1791520580458';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [
      orden,
      codigo,
      nombre,
      esExtra,
      esNocturna,
      esDominical,
      descripcion,
    ] of TIPOS_HORA) {
      await queryRunner.query(
        `INSERT INTO "tipos_hora" ("orden", "codigo", "nombre", "es_extra", "es_nocturna", "es_dominical_festiva", "descripcion")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orden, codigo, nombre, esExtra, esNocturna, esDominical, descripcion],
      );
    }
    for (const [codigo, valor, vigenteDesde, norma] of PARAMETROS) {
      await queryRunner.query(
        `INSERT INTO "parametros_legales" ("codigo", "valor", "vigente_desde", "norma") VALUES ($1, $2, $3, $4)`,
        [codigo, valor, vigenteDesde, norma],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "parametros_legales" WHERE "creado_por_id" IS NULL`,
    );
    await queryRunner.query(`DELETE FROM "tipos_hora"`);
  }
}
