import { MigrationInterface, QueryRunner } from "typeorm";

export class MaterialPrecioUnitario1791565334979 implements MigrationInterface {
    name = 'MaterialPrecioUnitario1791565334979'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "materiales_proyecto" ADD "precio_unitario" numeric(14,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "materiales_proyecto" DROP COLUMN "precio_unitario"`);
    }

}
