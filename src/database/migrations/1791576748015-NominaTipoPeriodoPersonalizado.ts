import { MigrationInterface, QueryRunner } from "typeorm";

export class NominaTipoPeriodoPersonalizado1791576748015 implements MigrationInterface {
    name = 'NominaTipoPeriodoPersonalizado1791576748015'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ALTER COLUMN TYPE en vez de DROP+ADD: conserva los valores existentes.
        await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" ALTER COLUMN "tipo_periodo" TYPE character varying(15)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" ALTER COLUMN "tipo_periodo" TYPE character varying(10)`);
    }

}
