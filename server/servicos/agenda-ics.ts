/**
 * Agenda .ics do link pessoal: as próximas escalas do membro (exceto nao_pode), 2h cada, local = unidade.
 * Os eventos e o calendário vêm de shared/dominio/ics.ts (RFC 5545).
 */
import type { Response } from 'express';
import { and, eq, gte, ne } from 'drizzle-orm';
import type { PapelEscala, StatusEscala, Turno } from '@shared/api';
import { eventoIcsDaEscala, gerarIcs, type EventoIcs } from '@shared/dominio/ics';
import { cultos, escalas, ministerios, unidades } from '@shared/schema';
import type { Banco } from '../db';
import { IGREJA, type LinhaMembro } from './consultas';
import { FUSO_PADRAO, compararCultos, hojeNoFuso, somarDias } from './dominio';
import { linkPessoal } from './tokens';

export async function agendaIcs(db: Banco, membro: LinhaMembro, base: string, agora: Date): Promise<string> {
  // "hoje" pelo fuso padrão da igreja; um dia de folga cobre unidades em outros fusos
  const desde = somarDias(hojeNoFuso(FUSO_PADRAO, agora), -1);
  const linhas = await db
    .select({ e: escalas, c: cultos, ministerioNome: ministerios.nome, u: unidades })
    .from(escalas)
    .innerJoin(cultos, eq(cultos.id, escalas.cultoId))
    .innerJoin(ministerios, eq(ministerios.id, escalas.ministerioId))
    .innerJoin(unidades, eq(unidades.id, cultos.unidadeId))
    .where(and(eq(escalas.membroId, membro.id), ne(escalas.status, 'nao_pode'), gte(cultos.data, desde)));
  const link = linkPessoal(base, membro.tokenAcesso);
  const eventos: EventoIcs[] = linhas
    .filter((l) => l.c.data >= hojeNoFuso(l.u.fusoHorario, agora))
    .sort((a, b) => compararCultos(a.c, b.c))
    .map((l) => eventoIcsDaEscala(
      {
        escalaId: l.e.id,
        culto: { data: l.c.data, hora: l.c.hora, turno: l.c.turno as Turno, titulo: l.c.titulo },
        ministerio: { nome: l.ministerioNome },
        funcao: l.e.funcao,
        papel: l.e.papel as PapelEscala,
        status: l.e.status as StatusEscala,
      },
      { nome: l.u.nome, endereco: l.u.endereco, fusoHorario: l.u.fusoHorario },
      { link },
    ))
    .filter((e): e is EventoIcs => e !== null);
  return gerarIcs(eventos, `Escalas · ${IGREJA.nome}`, { agora });
}

export async function enviarAgendaIcs(db: Banco, res: Response, membro: LinhaMembro, base: string, agora: Date): Promise<void> {
  const ics = await agendaIcs(db, membro, base, agora);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="escalas-boas-novas.ics"');
  res.setHeader('Cache-Control', 'private, no-cache');
  res.send(ics);
}
