/**
 * Lembretes pelo WhatsApp (o líder toca e o app abre a conversa com a mensagem pronta):
 * quem está aguardando confirmar (pendente) ou com troca sem substituto nos próximos N dias.
 */
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import type { LembreteDTO, StatusEscala } from '@shared/api';
import { linkWhatsApp, textoLembrete } from '@shared/dominio/whatsapp/exportar';
import { cultos, escalas, membros } from '@shared/schema';
import type { Banco } from '../db';
import { buscarUnidade, paraCultoDTO, type LinhaMinisterio } from './consultas';
import { FUSO_PADRAO, compararCultos, compararNomes, cultoJaPassou, hojeNoFuso, somarDias } from './dominio';
import { linkPessoal } from './tokens';

const STATUS_LEMBRETE: StatusEscala[] = ['pendente', 'troca'];

export async function listarLembretes(db: Banco, a: { ministerio: LinhaMinisterio; dias: number; base: string; agora: Date }): Promise<LembreteDTO[]> {
  const unidade = await buscarUnidade(db, a.ministerio.unidadeId);
  const fuso = unidade?.fusoHorario ?? FUSO_PADRAO;
  const hoje = hojeNoFuso(fuso, a.agora);
  const linhas = await db
    .select({ e: escalas, c: cultos, m: membros })
    .from(escalas)
    .innerJoin(cultos, eq(cultos.id, escalas.cultoId))
    .innerJoin(membros, eq(membros.id, escalas.membroId))
    .where(and(
      eq(escalas.ministerioId, a.ministerio.id),
      inArray(escalas.status, STATUS_LEMBRETE),
      gte(cultos.data, hoje),
      lte(cultos.data, somarDias(hoje, a.dias)),
      eq(membros.ativo, true),
    ));
  const porMembro = new Map<string, typeof linhas>();
  for (const l of linhas) {
    if (cultoJaPassou(l.c, fuso, a.agora)) continue;
    const lista = porMembro.get(l.m.id);
    if (lista) lista.push(l);
    else porMembro.set(l.m.id, [l]);
  }
  const lembretes: LembreteDTO[] = [];
  for (const lista of porMembro.values()) {
    const { m } = lista[0]!;
    const itens = lista
      .map((l) => ({ escalaId: l.e.id, culto: paraCultoDTO(l.c), status: l.e.status as StatusEscala }))
      .sort((x, y) => compararCultos(x.culto, y.culto));
    const texto = textoLembrete({
      nome: m.nome, itens, ministerio: a.ministerio.nome, unidade: unidade?.nome ?? '', link: linkPessoal(a.base, m.tokenAcesso),
    });
    lembretes.push({ membroId: m.id, nome: m.nome, telefone: m.telefone, itens, texto, linkWhatsApp: linkWhatsApp(texto, m.telefone) });
  }
  return lembretes.sort((x, y) => compararNomes(x.nome, y.nome));
}
