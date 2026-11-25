/**
 * Cobertura de um culto num ministério (SPEC §3): quantas pessoas contam para a escala e quantas faltam.
 * Função pura.
 */
import type { CoberturaDTO, StatusEscala } from '../api';

/** Vagas por culto quando o ministério não define outro número. */
export const VAGAS_PADRAO = 3;

/**
 * Cobertura a partir das escalas do culto e do número de vagas.
 * pessoas = confirmado + pendente + troca (nao_pode não conta); faltam = max(0, vagas − pessoas);
 * status: 'completo' (pessoas ≥ vagas), 'parcial' (0 < pessoas < vagas), 'vazio' (ninguém, havendo vaga).
 * Vagas inválidas usam VAGAS_PADRAO; com 0 vagas o culto já está completo.
 */
export function calcularCobertura(escalados: ReadonlyArray<{ status: StatusEscala | string }>, vagas: number): CoberturaDTO {
  let confirmados = 0;
  let pendentes = 0;
  let trocas = 0;
  for (const e of escalados) {
    if (e.status === 'confirmado') confirmados++;
    else if (e.status === 'pendente') pendentes++;
    else if (e.status === 'troca') trocas++;
  }
  const v = typeof vagas === 'number' && Number.isFinite(vagas) ? Math.max(0, Math.floor(vagas)) : VAGAS_PADRAO;
  const pessoas = confirmados + pendentes + trocas;
  const faltam = Math.max(0, v - pessoas);
  const status = pessoas >= v ? 'completo' : pessoas === 0 ? 'vazio' : 'parcial';
  return { pessoas, confirmados, pendentes, trocas, vagas: v, faltam, status };
}
