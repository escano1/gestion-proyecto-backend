import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Los materiales quedan con nombre, unidad, cantidad y precio: se eliminan descripción, observaciones,
 * fechas, estado, cantidad entregada y solicitante. Los materiales sin precio quedan en 0.
 */
export class MaterialesSimples1791620000000 implements MigrationInterface {
  name = 'MaterialesSimples1791620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "materiales_proyecto" SET "precio_unitario" = 0 WHERE "precio_unitario" IS NULL`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ALTER COLUMN "precio_unitario" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" DROP CONSTRAINT "FK_3ccedceb797a90f99134149165e"`);
    for (const columna of [
      'descripcion',
      'cantidad_entregada',
      'estado',
      'fecha_solicitud',
      'fecha_requerida',
      'fecha_entrega',
      'solicitado_por_id',
      'observaciones',
    ]) {
      await queryRunner.query(`ALTER TABLE "materiales_proyecto" DROP COLUMN "${columna}"`);
    }
  }

  /** Restaura las columnas con valores por defecto; lo eliminado no se recupera. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ADD "observaciones" text`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ADD "solicitado_por_id" integer`);
    await queryRunner.query(`UPDATE "materiales_proyecto" SET "solicitado_por_id" = (SELECT MIN(id) FROM usuarios)`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ALTER COLUMN "solicitado_por_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "materiales_proyecto" ADD CONSTRAINT "FK_3ccedceb797a90f99134149165e" FOREIGN KEY ("solicitado_por_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ADD "fecha_entrega" date`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ADD "fecha_requerida" date`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ADD "fecha_solicitud" date NOT NULL DEFAULT CURRENT_DATE`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ADD "estado" character varying(12) NOT NULL DEFAULT 'PENDIENTE'`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ADD "cantidad_entregada" numeric(12,2) NOT NULL DEFAULT '0'`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ADD "descripcion" text`);
    await queryRunner.query(`ALTER TABLE "materiales_proyecto" ALTER COLUMN "precio_unitario" DROP NOT NULL`);
  }
}
