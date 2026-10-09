import { Usuario } from '../modules/usuarios/usuario.entity.js';
import { Trabajador } from '../modules/trabajadores/trabajador.entity.js';
import { Proyecto } from '../modules/proyectos/proyecto.entity.js';
import { AsignacionProyecto } from '../modules/asignaciones/asignacion-proyecto.entity.js';
import { TipoHora } from '../modules/tipos-hora/tipo-hora.entity.js';
import { ParametroLegal } from '../modules/parametros/parametro-legal.entity.js';
import {
  RegistroHoras,
  RegistroHorasDetalle,
} from '../modules/registro-horas/registro-horas.entity.js';
import {
  ConceptoNomina,
  LiquidacionNomina,
  NominaTrabajador,
} from '../modules/nomina/nomina.entity.js';
import { MaterialProyecto } from '../modules/materiales/material-proyecto.entity.js';
import { HerramientaProyecto } from '../modules/herramientas/herramienta-proyecto.entity.js';
import { HitoProyecto } from '../modules/hitos/hito-proyecto.entity.js';
import {
  BitacoraAdjunto,
  BitacoraEntrada,
} from '../modules/bitacora/bitacora.entity.js';
import { RegistroAuditoria } from '../modules/auditoria/registro-auditoria.entity.js';

/** Lista explícita (sin globs) para que funcione igual en TS (pruebas) y en JS compilado. */
export const ENTIDADES = [
  Usuario,
  Trabajador,
  Proyecto,
  AsignacionProyecto,
  TipoHora,
  ParametroLegal,
  RegistroHoras,
  RegistroHorasDetalle,
  LiquidacionNomina,
  NominaTrabajador,
  ConceptoNomina,
  MaterialProyecto,
  HerramientaProyecto,
  HitoProyecto,
  BitacoraEntrada,
  BitacoraAdjunto,
  RegistroAuditoria,
];
