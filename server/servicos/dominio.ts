/**
 * Ponto único de contato do servidor com as regras puras de shared/dominio (agente A1, SPEC §4).
 * Se alguma assinatura mudar, só este arquivo precisa ser ajustado.
 */
import type { Turno } from '@shared/api';
import { hojeNoFuso, somarDias, diaSemana, instanteDoCulto, janelaCheckin, horaParaMinutos, dataValida, partesData, FUSO_PADRAO } from '@shared/dominio/datas';
import { compararCultos, normalizarEvento, TURNOS, ehTurno } from '@shared/dominio/turnos';
import { datasDoMes, vespera, ehDiaFixo, idCulto } from '@shared/dominio/agenda';
import { compararNomes, normalizar, slug, tituloNome } from '@shared/dominio/texto';

export { calcularCobertura } from '@shared/dominio/cobertura';
export {
  hojeNoFuso, somarDias, diaSemana, instanteDoCulto, janelaCheckin, horaParaMinutos, dataValida, partesData, FUSO_PADRAO,
  compararCultos, normalizarEvento, datasDoMes, vespera, ehDiaFixo, idCulto,
  compararNomes, normalizar, slug, tituloNome,
};

/** Hora do culto ou, sem hora definida (evento extra sem horário), a hora de costume do turno. */
export function horaOuPadrao(hora: string, turno: string): string {
  if (hora) return hora;
  return ehTurno(turno) ? TURNOS[turno].horaPadrao : TURNOS.unico.horaPadrao;
}

/** Instante de início do culto (UTC) no fuso da unidade. */
export function inicioDoCulto(culto: { data: string; hora: string; turno: string }, fuso: string): Date {
  return instanteDoCulto(culto.data, horaOuPadrao(culto.hora, culto.turno), fuso || FUSO_PADRAO);
}

/** Culto já começou/passou? Datas anteriores a hoje sempre; hoje, a partir do horário de início. */
export function cultoJaPassou(culto: { data: string; hora: string; turno: string }, fuso: string, agora: Date): boolean {
  const hoje = hojeNoFuso(fuso, agora);
  if (culto.data < hoje) return true;
  if (culto.data > hoje) return false;
  if (!culto.hora) return false;
  return agora.getTime() >= inicioDoCulto(culto, fuso).getTime();
}

/** Slug para ids legíveis; nunca vazio. */
export function slugOuPadrao(texto: string, padrao: string): string {
  return slug(texto) || padrao;
}

/** Id livre a partir de uma base: base, base-2, base-3… */
export function idLivre(base: string, usados: ReadonlySet<string>): string {
  if (!usados.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidato = `${base}-${i}`;
    if (!usados.has(candidato)) return candidato;
  }
}

export type { Turno };
