import { MigrationInterface, QueryRunner } from 'typeorm';

export class EsquemaInicial1791520580457 implements MigrationInterface {
  name = 'EsquemaInicial1791520580457';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "usuarios" ("id" SERIAL NOT NULL, "nombre" character varying(120) NOT NULL, "email" character varying(160) NOT NULL, "password_hash" character varying(100) NOT NULL, "rol" character varying(30) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_446adfc18b35418aac32ae0b7b5" UNIQUE ("email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trabajadores" ("id" SERIAL NOT NULL, "nombre" character varying(150) NOT NULL, "tipo_documento" character varying(5) NOT NULL, "numero_documento" character varying(30) NOT NULL, "cargo" character varying(100) NOT NULL, "tipo_salario" character varying(10) NOT NULL, "salario_base" numeric(14,2) NOT NULL, "tipo_contrato" character varying(15) NOT NULL, "tipo_jornada" character varying(10) NOT NULL DEFAULT 'COMPLETA', "horas_semanales" numeric(5,2), "aplica_auxilio_transporte" boolean NOT NULL DEFAULT true, "fecha_ingreso" date NOT NULL, "fecha_retiro" date, "estado" character varying(10) NOT NULL DEFAULT 'ACTIVO', "email" character varying(160), "telefono" character varying(30), "eps" character varying(100), "fondo_pension" character varying(100), "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b914e2e6b59de0b96b51e9e028d" UNIQUE ("numero_documento"), CONSTRAINT "PK_572c7e550b3d755a9826d4a5daa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "proyectos" ("id" SERIAL NOT NULL, "codigo" character varying(30) NOT NULL, "nombre" character varying(200) NOT NULL, "cliente" character varying(150) NOT NULL, "ubicacion" character varying(200) NOT NULL, "descripcion" text, "fecha_inicio" date NOT NULL, "fecha_fin_planeada" date, "fecha_fin_real" date, "estado" character varying(12) NOT NULL DEFAULT 'ACTIVO', "presupuesto" numeric(16,2), "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f4de238443ebaadb96ef4d7c56b" UNIQUE ("codigo"), CONSTRAINT "PK_4763a49914127cbdde2143db52a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "asignaciones_proyecto" ("id" SERIAL NOT NULL, "trabajador_id" integer NOT NULL, "proyecto_id" integer NOT NULL, "fecha_inicio" date NOT NULL, "fecha_fin" date, "rol_en_proyecto" character varying(100), "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0e4e2ae46bb1a80545aac9a5627" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_825f1dd7b8daf326ab006b2cb2" ON "asignaciones_proyecto"  ("proyecto_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e160de27c758167fcd9334a8cb" ON "asignaciones_proyecto"  ("trabajador_id", "proyecto_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tipos_hora" ("id" SERIAL NOT NULL, "codigo" character varying(10) NOT NULL, "nombre" character varying(80) NOT NULL, "descripcion" character varying(255), "es_extra" boolean NOT NULL, "es_nocturna" boolean NOT NULL, "es_dominical_festiva" boolean NOT NULL, "orden" smallint NOT NULL, "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_9dac551a0bab87f70f0ce3cf0b9" UNIQUE ("codigo"), CONSTRAINT "PK_c91613eeeceb9d281ec66f2a586" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "parametros_legales" ("id" SERIAL NOT NULL, "codigo" character varying(40) NOT NULL, "valor" numeric(18,6) NOT NULL, "vigente_desde" date NOT NULL, "norma" character varying(255), "creado_por_id" integer, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e1d76d551f38805f5da82c2918a" UNIQUE ("codigo", "vigente_desde"), CONSTRAINT "PK_4ea8eb2c62ecc51d26458261e8f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "registros_horas" ("id" SERIAL NOT NULL, "trabajador_id" integer NOT NULL, "proyecto_id" integer NOT NULL, "fecha" date NOT NULL, "observacion" character varying(500), "creado_por_id" integer NOT NULL, "actualizado_por_id" integer, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_registro_trabajador_proyecto_fecha" UNIQUE ("trabajador_id", "proyecto_id", "fecha"), CONSTRAINT "PK_b7d83d7f122bd3806a868c4826f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d626b86c47953b2c14cf8f580e" ON "registros_horas"  ("trabajador_id", "fecha") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e93901d82b37e454d7b1d2cb1" ON "registros_horas"  ("fecha") `,
    );
    await queryRunner.query(
      `CREATE TABLE "registros_horas_detalle" ("id" SERIAL NOT NULL, "registro_id" integer NOT NULL, "tipo_hora_id" integer NOT NULL, "horas" numeric(5,2) NOT NULL, CONSTRAINT "UQ_ed4cae209f49ecfad23d2316895" UNIQUE ("registro_id", "tipo_hora_id"), CONSTRAINT "PK_ced9641882b4f1eae5dd391361a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "liquidaciones_nomina" ("id" SERIAL NOT NULL, "tipo_periodo" character varying(10) NOT NULL, "anio" smallint NOT NULL, "mes" smallint NOT NULL, "quincena" smallint, "fecha_inicio" date NOT NULL, "fecha_fin" date NOT NULL, "estado" character varying(10) NOT NULL DEFAULT 'BORRADOR', "requiere_recalculo" boolean NOT NULL DEFAULT false, "total_devengado" numeric(16,2) NOT NULL DEFAULT '0', "total_deducciones" numeric(16,2) NOT NULL DEFAULT '0', "total_neto" numeric(16,2) NOT NULL DEFAULT '0', "numero_trabajadores" integer NOT NULL DEFAULT '0', "calculada_en" TIMESTAMP WITH TIME ZONE, "creado_por_id" integer NOT NULL, "cerrada_por_id" integer, "cerrada_en" TIMESTAMP WITH TIME ZONE, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7252a4ce67988618a4317e4d438" UNIQUE ("fecha_inicio", "fecha_fin"), CONSTRAINT "PK_478816879f6c7b251669ea54579" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "nominas_trabajador" ("id" SERIAL NOT NULL, "liquidacion_id" integer NOT NULL, "trabajador_id" integer NOT NULL, "nombre_trabajador" character varying(150) NOT NULL, "tipo_documento" character varying(5) NOT NULL, "numero_documento" character varying(30) NOT NULL, "cargo" character varying(100) NOT NULL, "tipo_salario" character varying(10) NOT NULL, "salario_base" numeric(16,2) NOT NULL, "valor_hora" numeric(16,2) NOT NULL, "dias_laborados" smallint NOT NULL, "ibc" numeric(16,2) NOT NULL, "total_devengado" numeric(16,2) NOT NULL, "total_deducciones" numeric(16,2) NOT NULL, "neto_pagar" numeric(16,2) NOT NULL, "parametros" jsonb NOT NULL, "alertas" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "UQ_c1878acee7482622a0a82162f88" UNIQUE ("liquidacion_id", "trabajador_id"), CONSTRAINT "PK_48e7f7264ff43dc13699f43cdcd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b47427c00bef2f150ff83edb95" ON "nominas_trabajador"  ("trabajador_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "conceptos_nomina" ("id" SERIAL NOT NULL, "nomina_trabajador_id" integer NOT NULL, "tipo" character varying(10) NOT NULL, "codigo" character varying(30) NOT NULL, "descripcion" character varying(150) NOT NULL, "cantidad" numeric(10,2), "valor_unitario" numeric(16,2), "valor" numeric(16,2) NOT NULL, "orden" smallint NOT NULL, CONSTRAINT "PK_d81a1c5a4bc79845a74b67a7921" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dc6b3ba5af984442f48e094cb1" ON "conceptos_nomina"  ("nomina_trabajador_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "materiales_proyecto" ("id" SERIAL NOT NULL, "proyecto_id" integer NOT NULL, "nombre" character varying(150) NOT NULL, "descripcion" text, "unidad_medida" character varying(20) NOT NULL, "cantidad_solicitada" numeric(12,2) NOT NULL, "cantidad_entregada" numeric(12,2) NOT NULL DEFAULT '0', "estado" character varying(12) NOT NULL DEFAULT 'PENDIENTE', "fecha_solicitud" date NOT NULL, "fecha_requerida" date, "fecha_entrega" date, "solicitado_por_id" integer NOT NULL, "observaciones" text, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_09471133facaf81e4a6c931deb5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8ac5b348177c0bfc5d81d55aa5" ON "materiales_proyecto"  ("proyecto_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "herramientas_proyecto" ("id" SERIAL NOT NULL, "proyecto_id" integer NOT NULL, "nombre" character varying(150) NOT NULL, "codigo" character varying(50), "cantidad" integer NOT NULL, "responsable_id" integer, "fecha_asignacion" date NOT NULL, "fecha_devolucion_prevista" date, "fecha_devolucion" date, "estado" character varying(12) NOT NULL DEFAULT 'ASIGNADA', "observaciones" text, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ec0f854d06371d521e3702834e4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0e69550904f001646294ea5f55" ON "herramientas_proyecto"  ("proyecto_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "hitos_proyecto" ("id" SERIAL NOT NULL, "proyecto_id" integer NOT NULL, "nombre" character varying(150) NOT NULL, "descripcion" text, "orden" smallint NOT NULL DEFAULT '0', "fecha_planeada" date NOT NULL, "fecha_real" date, "peso" numeric(5,2) NOT NULL, "porcentaje_avance" numeric(5,2) NOT NULL DEFAULT '0', "estado" character varying(12) NOT NULL DEFAULT 'PENDIENTE', "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b22e95e6eafb857a4ac9a806161" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7a663f07ef558adb9df01e6d0b" ON "hitos_proyecto"  ("proyecto_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "bitacora_entradas" ("id" SERIAL NOT NULL, "proyecto_id" integer NOT NULL, "fecha" date NOT NULL, "descripcion" text NOT NULL, "observaciones" text, "autor_id" integer NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dfcd769b1384b6ee7d03c230773" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40b3430becc21af35a06a664fb" ON "bitacora_entradas"  ("proyecto_id", "fecha") `,
    );
    await queryRunner.query(
      `CREATE TABLE "bitacora_adjuntos" ("id" SERIAL NOT NULL, "entrada_id" integer NOT NULL, "nombre_archivo" character varying(255) NOT NULL, "mime_type" character varying(100) NOT NULL, "tamano_bytes" integer NOT NULL, "contenido" bytea NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c77d3098b5005c0dc5751a20510" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df68767a8a53d10bbffdfe472b" ON "bitacora_adjuntos"  ("entrada_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "auditoria" ("id" SERIAL NOT NULL, "entidad" character varying(60) NOT NULL, "entidad_id" character varying(40) NOT NULL, "accion" character varying(20) NOT NULL, "datos_anteriores" jsonb, "datos_nuevos" jsonb, "descripcion" character varying(255), "usuario_id" integer, "usuario_email" character varying(160), "fecha" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_135fe98308816fe3a2d458e6637" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b92ed16d3033415d97c5113d0d" ON "auditoria"  ("fecha") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fdfb12f33f6d47688004dd13b9" ON "auditoria"  ("entidad", "entidad_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "asignaciones_proyecto" ADD CONSTRAINT "FK_06415c42a65af52bbce8cd6aa4a" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "asignaciones_proyecto" ADD CONSTRAINT "FK_825f1dd7b8daf326ab006b2cb2d" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas" ADD CONSTRAINT "FK_1c7a45ea23237025f08d0493b1e" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas" ADD CONSTRAINT "FK_1db17c3d12443726d3d76a47aaf" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas" ADD CONSTRAINT "FK_b53b5a50cffeceee25cc8a67c52" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas" ADD CONSTRAINT "FK_e59ff4cf27000145126380e94ca" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas_detalle" ADD CONSTRAINT "FK_ddf4ea0a91da49bb68191f438f4" FOREIGN KEY ("registro_id") REFERENCES "registros_horas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas_detalle" ADD CONSTRAINT "FK_349da712941dcacb0a9612d48cf" FOREIGN KEY ("tipo_hora_id") REFERENCES "tipos_hora"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nominas_trabajador" ADD CONSTRAINT "FK_57ff3080baa3067f200e3d48758" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidaciones_nomina"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "nominas_trabajador" ADD CONSTRAINT "FK_b47427c00bef2f150ff83edb953" FOREIGN KEY ("trabajador_id") REFERENCES "trabajadores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conceptos_nomina" ADD CONSTRAINT "FK_dc6b3ba5af984442f48e094cb16" FOREIGN KEY ("nomina_trabajador_id") REFERENCES "nominas_trabajador"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "materiales_proyecto" ADD CONSTRAINT "FK_8ac5b348177c0bfc5d81d55aa5e" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "materiales_proyecto" ADD CONSTRAINT "FK_3ccedceb797a90f99134149165e" FOREIGN KEY ("solicitado_por_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "herramientas_proyecto" ADD CONSTRAINT "FK_0e69550904f001646294ea5f55b" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "herramientas_proyecto" ADD CONSTRAINT "FK_e7de717c49e92362a9fb321e76f" FOREIGN KEY ("responsable_id") REFERENCES "trabajadores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hitos_proyecto" ADD CONSTRAINT "FK_7a663f07ef558adb9df01e6d0bf" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_entradas" ADD CONSTRAINT "FK_6c6796c83d82ee8d6fecc26f9e7" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_entradas" ADD CONSTRAINT "FK_9937252c9fcd94e84e9c91bf149" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_adjuntos" ADD CONSTRAINT "FK_df68767a8a53d10bbffdfe472be" FOREIGN KEY ("entrada_id") REFERENCES "bitacora_entradas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bitacora_adjuntos" DROP CONSTRAINT "FK_df68767a8a53d10bbffdfe472be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_entradas" DROP CONSTRAINT "FK_9937252c9fcd94e84e9c91bf149"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_entradas" DROP CONSTRAINT "FK_6c6796c83d82ee8d6fecc26f9e7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hitos_proyecto" DROP CONSTRAINT "FK_7a663f07ef558adb9df01e6d0bf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "herramientas_proyecto" DROP CONSTRAINT "FK_e7de717c49e92362a9fb321e76f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "herramientas_proyecto" DROP CONSTRAINT "FK_0e69550904f001646294ea5f55b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "materiales_proyecto" DROP CONSTRAINT "FK_3ccedceb797a90f99134149165e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "materiales_proyecto" DROP CONSTRAINT "FK_8ac5b348177c0bfc5d81d55aa5e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conceptos_nomina" DROP CONSTRAINT "FK_dc6b3ba5af984442f48e094cb16"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nominas_trabajador" DROP CONSTRAINT "FK_b47427c00bef2f150ff83edb953"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nominas_trabajador" DROP CONSTRAINT "FK_57ff3080baa3067f200e3d48758"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas_detalle" DROP CONSTRAINT "FK_349da712941dcacb0a9612d48cf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas_detalle" DROP CONSTRAINT "FK_ddf4ea0a91da49bb68191f438f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas" DROP CONSTRAINT "FK_e59ff4cf27000145126380e94ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas" DROP CONSTRAINT "FK_b53b5a50cffeceee25cc8a67c52"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas" DROP CONSTRAINT "FK_1db17c3d12443726d3d76a47aaf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registros_horas" DROP CONSTRAINT "FK_1c7a45ea23237025f08d0493b1e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asignaciones_proyecto" DROP CONSTRAINT "FK_825f1dd7b8daf326ab006b2cb2d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "asignaciones_proyecto" DROP CONSTRAINT "FK_06415c42a65af52bbce8cd6aa4a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fdfb12f33f6d47688004dd13b9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b92ed16d3033415d97c5113d0d"`,
    );
    await queryRunner.query(`DROP TABLE "auditoria"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_df68767a8a53d10bbffdfe472b"`,
    );
    await queryRunner.query(`DROP TABLE "bitacora_adjuntos"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40b3430becc21af35a06a664fb"`,
    );
    await queryRunner.query(`DROP TABLE "bitacora_entradas"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7a663f07ef558adb9df01e6d0b"`,
    );
    await queryRunner.query(`DROP TABLE "hitos_proyecto"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0e69550904f001646294ea5f55"`,
    );
    await queryRunner.query(`DROP TABLE "herramientas_proyecto"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8ac5b348177c0bfc5d81d55aa5"`,
    );
    await queryRunner.query(`DROP TABLE "materiales_proyecto"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dc6b3ba5af984442f48e094cb1"`,
    );
    await queryRunner.query(`DROP TABLE "conceptos_nomina"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b47427c00bef2f150ff83edb95"`,
    );
    await queryRunner.query(`DROP TABLE "nominas_trabajador"`);
    await queryRunner.query(`DROP TABLE "liquidaciones_nomina"`);
    await queryRunner.query(`DROP TABLE "registros_horas_detalle"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e93901d82b37e454d7b1d2cb1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d626b86c47953b2c14cf8f580e"`,
    );
    await queryRunner.query(`DROP TABLE "registros_horas"`);
    await queryRunner.query(`DROP TABLE "parametros_legales"`);
    await queryRunner.query(`DROP TABLE "tipos_hora"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e160de27c758167fcd9334a8cb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_825f1dd7b8daf326ab006b2cb2"`,
    );
    await queryRunner.query(`DROP TABLE "asignaciones_proyecto"`);
    await queryRunner.query(`DROP TABLE "proyectos"`);
    await queryRunner.query(`DROP TABLE "trabajadores"`);
    await queryRunner.query(`DROP TABLE "usuarios"`);
  }
}
