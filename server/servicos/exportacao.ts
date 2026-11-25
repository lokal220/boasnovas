/**
 * Exportar a escala no formato da lista do WhatsApp (textoEscala de shared/dominio/whatsapp/exportar.ts).
 * Padrão: de hoje (ou hoje−30 com passados) até hoje+120; só os cultos que o ministério atende.
 */
import type { ExportacaoDTO } from '@shared/api';
import { textoEscala } from '@shared/dominio/whatsapp/exportar';
import type { Banco } from '../db';
import { invalido } from '../http';
import { DIAS_ANTES, DIAS_DEPOIS, buscarAgenda, buscarUnidade, cultosComEscala, type LinhaMinisterio } from './consultas';
import { FUSO_PADRAO, hojeNoFuso, somarDias } from './dominio';
import { linkPublico } from './tokens';

export async function exportarEscala(db: Banco, a: {
  ministerio: LinhaMinisterio; base: string; agora: Date; de?: string; ate?: string; incluirPassados: boolean;
}): Promise<ExportacaoDTO> {
  const [unidade, agenda] = await Promise.all([buscarUnidade(db, a.ministerio.unidadeId), buscarAgenda(db, a.ministerio.unidadeId)]);
  const hoje = hojeNoFuso(unidade?.fusoHorario ?? FUSO_PADRAO, a.agora);
  const de = a.de ?? (a.incluirPassados ? somarDias(hoje, -DIAS_ANTES) : hoje);
  const ate = a.ate ?? somarDias(hoje, DIAS_DEPOIS);
  if (de > ate) throw invalido('A data inicial precisa ser antes da final.');
  const cultos = await cultosComEscala(db, a.ministerio, agenda, { de, ate });
  const link = linkPublico(a.base, a.ministerio.tokenPublico);
  const texto = textoEscala(cultos, {
    ministerio: { nome: a.ministerio.nome, aviso: a.ministerio.aviso },
    link,
    hoje,
    incluirPassados: a.incluirPassados,
  });
  return { texto, link };
}
