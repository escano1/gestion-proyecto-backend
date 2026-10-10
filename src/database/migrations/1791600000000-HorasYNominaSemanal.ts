import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Simplificación: las horas se registran por semana (el registro lleva el lunes de la semana),
 * la nómina se liquida por semana y se eliminan las fechas de ingreso/retiro y las de asignación.
 */
export class HorasYNominaSemanal1791600000000 implements MigrationInterface {
  name = 'HorasYNominaSemanal1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Horas: un registro por trabajador, proyecto y semana (suma de los días).
    await queryRunner.query(`
      CREATE TEMP TABLE _detalle_semanal ON COMMIT DROP AS
      SELECT s.sobreviviente AS registro_id, d.tipo_hora_id, SUM(d.horas) AS horas
        FROM registros_horas r
        JOIN registros_horas_detalle d ON d.registro_id = r.id
        JOIN (
          SELECT trabajador_id, proyecto_id, date_trunc('week', fecha)::date AS semana, MIN(id) AS sobreviviente
            FROM registros_horas
           GROUP BY trabajador_id, proyecto_id, date_trunc('week', fecha)::date
        ) s ON s.trabajador_id = r.trabajador_id
           AND s.proyecto_id = r.proyecto_id
           AND s.semana = date_trunc('week', r.fecha)::date
       GROUP BY s.sobreviviente, d.tipo_hora_id
    `);
    await queryRunner.query(`DELETE FROM registros_horas_detalle`);
    await queryRunner.query(`
      DELETE FROM registros_horas
       WHERE id NOT IN (SELECT MIN(id) FROM registros_horas
                         GROUP BY trabajador_id, proyecto_id, date_trunc('week', fecha)::date)
    `);
    await queryRunner.query(`UPDATE registros_horas SET fecha = date_trunc('week', fecha)::date`);
    await queryRunner.query(`
      INSERT INTO registros_horas_detalle (registro_id, tipo_hora_id, horas)
      SELECT registro_id, tipo_hora_id, horas FROM _detalle_semanal
    `);

    // 2. Nómina: solo liquidaciones semanales (lunes a domingo); las demás no son convertibles.
    await queryRunner.query(`
      DELETE FROM liquidaciones_nomina
       WHERE fecha_inicio <> date_trunc('week', fecha_inicio)::date
          OR fecha_fin <> fecha_inicio + 6
    `);
    await queryRunner.query(`UPDATE liquidaciones_nomina SET requiere_recalculo = true WHERE estado = 'BORRADOR'`);
    await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" DROP CONSTRAINT "UQ_7252a4ce67988618a4317e4d438"`);
    await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" DROP COLUMN "tipo_periodo"`);
    await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" DROP COLUMN "mes"`);
    await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" DROP COLUMN "quincena"`);
    await queryRunner.query(
      `ALTER TABLE "liquidaciones_nomina" ADD CONSTRAINT "uq_liquidacion_fecha_inicio" UNIQUE ("fecha_inicio")`,
    );

    // 3. Asignaciones: una por trabajador y proyecto, sin fechas.
    await queryRunner.query(`
      DELETE FROM asignaciones_proyecto
       WHERE id NOT IN (SELECT MIN(id) FROM asignaciones_proyecto GROUP BY trabajador_id, proyecto_id)
    `);
    await queryRunner.query(`DROP INDEX "IDX_e160de27c758167fcd9334a8cb"`);
    await queryRunner.query(`ALTER TABLE "asignaciones_proyecto" DROP COLUMN "fecha_inicio"`);
    await queryRunner.query(`ALTER TABLE "asignaciones_proyecto" DROP COLUMN "fecha_fin"`);
    await queryRunner.query(
      `ALTER TABLE "asignaciones_proyecto" ADD CONSTRAINT "uq_asignacion_trabajador_proyecto" UNIQUE ("trabajador_id", "proyecto_id")`,
    );

    // 4. Trabajadores: sin fechas de ingreso ni retiro.
    await queryRunner.query(`ALTER TABLE "trabajadores" DROP COLUMN "fecha_ingreso"`);
    await queryRunner.query(`ALTER TABLE "trabajadores" DROP COLUMN "fecha_retiro"`);
  }

  /** Restaura la estructura; los datos fusionados por semana y las liquidaciones eliminadas no se recuperan. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "trabajadores" ADD "fecha_retiro" date`);
    await queryRunner.query(`ALTER TABLE "trabajadores" ADD "fecha_ingreso" date NOT NULL DEFAULT CURRENT_DATE`);
    await queryRunner.query(`ALTER TABLE "trabajadores" ALTER COLUMN "fecha_ingreso" DROP DEFAULT`);

    await queryRunner.query(`ALTER TABLE "asignaciones_proyecto" DROP CONSTRAINT "uq_asignacion_trabajador_proyecto"`);
    await queryRunner.query(`ALTER TABLE "asignaciones_proyecto" ADD "fecha_fin" date`);
    await queryRunner.query(`ALTER TABLE "asignaciones_proyecto" ADD "fecha_inicio" date NOT NULL DEFAULT '2024-01-01'`);
    await queryRunner.query(`ALTER TABLE "asignaciones_proyecto" ALTER COLUMN "fecha_inicio" DROP DEFAULT`);
    await queryRunner.query(
      `CREATE INDEX "IDX_e160de27c758167fcd9334a8cb" ON "asignaciones_proyecto" ("trabajador_id", "proyecto_id")`,
    );

    await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" DROP CONSTRAINT "uq_liquidacion_fecha_inicio"`);
    await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" ADD "quincena" smallint`);
    await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" ADD "mes" smallint NOT NULL DEFAULT 1`);
    await queryRunner.query(`UPDATE "liquidaciones_nomina" SET "mes" = EXTRACT(MONTH FROM fecha_inicio)`);
    await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" ALTER COLUMN "mes" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "liquidaciones_nomina" ADD "tipo_periodo" character varying(15) NOT NULL DEFAULT 'PERSONALIZADO'`,
    );
    await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" ALTER COLUMN "tipo_periodo" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "liquidaciones_nomina" ADD CONSTRAINT "UQ_7252a4ce67988618a4317e4d438" UNIQUE ("fecha_inicio", "fecha_fin")`,
    );
  }
}
