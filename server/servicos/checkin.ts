/**
 * Check-in no dia: abre 2h antes do início do culto e fecha 3h depois (fuso da unidade). Uma vez só.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { CheckinDTO } from '@shared/api';
import { escalas } from '@shared/schema';
import type { Banco } from '../db';
import { conflito } from '../http';
import type { LinhaCulto, LinhaEscala } from './consultas';
import { horaOuPadrao, janelaCheckin } from './dominio';
import { definirStatus } from './escalas';
import { registrar, type Ator } from './registros';

/** Janela do check-in do culto (hora vazia usa a hora de costume do turno). */
export function janelaDoCulto(culto: Pick<LinhaCulto, 'data' | 'hora' | 'turno'>, fuso: string): { abre: Date; fecha: Date } {
  const { abreEm, fechaEm } = janelaCheckin(culto.data, horaOuPadrao(culto.hora, culto.turno), fuso);
  return { abre: abreEm, fecha: fechaEm };
}

export function checkinDTO(escala: Pick<LinhaEscala, 'status' | 'checkinEm'>, culto: Pick<LinhaCulto, 'data' | 'hora' | 'turno'>, fuso: string, agora: Date): CheckinDTO {
  const { abre, fecha } = janelaDoCulto(culto, fuso);
  const t = agora.getTime();
  return {
    podeFazer: !escala.checkinEm && escala.status !== 'nao_pode' && t >= abre.getTime() && t <= fecha.getTime(),
    feitoEm: escala.checkinEm ? escala.checkinEm.toISOString() : null,
    abreEm: abre.toISOString(),
    fechaEm: fecha.toISOString(),
  };
}

export async function fazerCheckin(db: Banco, a: { escala: LinhaEscala; culto: LinhaCulto; fuso: string; agora: Date; ator: Ator }): Promise<void> {
  if (a.escala.checkinEm) throw conflito('Seu check-in já foi feito. Bom culto!');
  if (a.escala.status === 'nao_pode') throw conflito('Você avisou que não pode nesse culto. Fale com seu líder.');
  const { abre, fecha } = janelaDoCulto(a.culto, a.fuso);
  const t = a.agora.getTime();
  if (t < abre.getTime()) throw conflito('O check-in abre 2 horas antes do culto.');
  if (t > fecha.getTime()) throw conflito('O check-in deste culto já fechou.');
  await db.transaction(async (tx) => {
    // atualização condicional: dois toques simultâneos não fazem dois check-ins
    const marcadas = await tx.update(escalas).set({ checkinEm: a.agora, atualizadoEm: a.agora })
      .where(and(eq(escalas.id, a.escala.id), isNull(escalas.checkinEm)))
      .returning({ id: escalas.id });
    if (!marcadas.length) throw conflito('Seu check-in já foi feito. Bom culto!');
    // presença confirma a escala (e encerra um pedido de troca aberto)
    if (a.escala.status !== 'confirmado') await definirStatus(tx, a.escala, 'confirmado', a.agora);
    await registrar(tx, {
      ator: a.ator, acao: 'escala.checkin', alvo: a.escala.id, ministerioId: a.escala.ministerioId, quando: a.agora,
      dados: { cultoId: a.culto.id, membroId: a.escala.membroId },
    });
  });
}
