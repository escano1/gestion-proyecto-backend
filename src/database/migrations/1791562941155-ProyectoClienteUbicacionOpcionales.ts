import { MigrationInterface, QueryRunner } from "typeorm";

export class ProyectoClienteUbicacionOpcionales1791562941155 implements MigrationInterface {
    name = 'ProyectoClienteUbicacionOpcionales1791562941155'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "proyectos" ALTER COLUMN "cliente" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "proyectos" ALTER COLUMN "ubicacion" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "proyectos" ALTER COLUMN "ubicacion" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "proyectos" ALTER COLUMN "cliente" SET NOT NULL`);
    }

}
