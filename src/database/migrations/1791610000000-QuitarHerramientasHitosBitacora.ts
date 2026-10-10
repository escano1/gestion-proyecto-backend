import { MigrationInterface, QueryRunner } from 'typeorm';

/** El proyecto queda básico (horas y costos): se eliminan herramientas, hitos y bitácora con sus datos. */
export class QuitarHerramientasHitosBitacora1791610000000 implements MigrationInterface {
  name = 'QuitarHerramientasHitosBitacora1791610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bitacora_adjuntos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bitacora_entradas"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hitos_proyecto"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "herramientas_proyecto"`);
  }

  /** Recrea las tablas vacías; los datos eliminados no se recuperan. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "herramientas_proyecto" ("id" SERIAL NOT NULL, "proyecto_id" integer NOT NULL, "nombre" character varying(150) NOT NULL, "codigo" character varying(50), "cantidad" integer NOT NULL DEFAULT 1, "responsable_id" integer, "fecha_asignacion" date NOT NULL, "fecha_devolucion_prevista" date, "fecha_devolucion" date, "estado" character varying(12) NOT NULL DEFAULT 'ASIGNADA', "observaciones" text, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_herramientas_proyecto" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "hitos_proyecto" ("id" SERIAL NOT NULL, "proyecto_id" integer NOT NULL, "nombre" character varying(150) NOT NULL, "descripcion" text, "fecha_planeada" date NOT NULL, "fecha_real" date, "peso" numeric(5,2) NOT NULL, "porcentaje_avance" numeric(5,2) NOT NULL DEFAULT 0, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_hitos_proyecto" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bitacora_entradas" ("id" SERIAL NOT NULL, "proyecto_id" integer NOT NULL, "fecha" date NOT NULL, "descripcion" text NOT NULL, "creado_por_id" integer NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bitacora_entradas" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bitacora_adjuntos" ("id" SERIAL NOT NULL, "entrada_id" integer NOT NULL, "nombre_archivo" character varying(255) NOT NULL, CONSTRAINT "PK_bitacora_adjuntos" PRIMARY KEY ("id"))`,
    );
  }
}
