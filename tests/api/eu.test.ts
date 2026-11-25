import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import type { MinhaEscalaDTO, MinhaEscalaItemDTO, TrocaDTO } from '@shared/api';
import { escalas, membros, ministerioMembros, ministerios, registros, trocas } from '@shared/schema';
import { criarAmbiente, tokenDoMembro, type Ambiente } from './_ambiente';

let amb: Ambiente;
let tokenHerick: string;
let tokenYan: string;
let tokenLucas: string;

beforeAll(async () => {
  amb = await criarAmbiente();
  tokenHerick = await tokenDoMembro(amb.db, 'herick');
  tokenYan = await tokenDoMembro(amb.db, 'yan');
  tokenLucas = await tokenDoMembro(amb.db, 'lucas');
});
afterAll(async () => { await amb.fechar(); });

const post = (caminho: string, corpo: object = {}) => request(amb.app).post(caminho).set('X-BN', '1').send(corpo);

async function escalaDe(membroId: string, cultoId: string) {
  const [e] = await amb.db.select().from(escalas).where(and(eq(escalas.membroId, membroId), eq(escalas.cultoId, cultoId)));
  if (!e) throw new Error(`sem escala de ${membroId} em ${cultoId}`);
  return e;
}

describe('GET /api/eu/:token', () => {
  it('mostra só as escalas daquele membro, com equipe, check-in e oportunidades', async () => {
    const res = await request(amb.app).get(`/api/eu/${tokenHerick}`);
    expect(res.status).toBe(200);
    const dto = res.body as MinhaEscalaDTO;
    expect(dto.membro).toEqual({ id: 'herick', nome: 'Herick' });
    expect(dto.hoje).toBe('2026-11-25');
    expect(dto.unidade.id).toBe('bn-estoril');
    expect(dto.ministerios).toEqual([{ id: 'altar', nome: 'Altar', papel: 'servo', linkPublico: expect.stringMatching(/\/e\/[A-Za-z0-9_-]{24}$/), acesso: 'aberto' }]);
    expect(dto.proximas.map((i) => i.culto.data)).toEqual(['2026-11-25', '2026-12-02', '2026-12-06', '2026-12-09', '2026-12-16', '2026-12-23', '2026-12-30']);
    expect(dto.passadas.map((i) => i.culto.data)).toEqual(['2026-11-18']);
    const hoje = dto.proximas[0]!;
    expect(hoje).toMatchObject({ ministerio: { id: 'altar', nome: 'Altar' }, papel: 'servo', status: 'confirmado' });
    expect(hoje.equipe.map((p) => p.nome)).toEqual(['Thiago Daniel', 'Herick', 'Alê', 'Matheus Augusto', 'Herbert']);
    expect(hoje.checkin).toEqual({ podeFazer: false, feitoEm: null, abreEm: '2026-11-25T20:30:00.000Z', fechaEm: '2026-11-26T01:30:00.000Z' });
    expect(dto.oportunidades).toHaveLength(21 - 7);
    expect(dto.oportunidades.every((c) => !c.escalados.some((e) => e.membroId === 'herick'))).toBe(true);
    expect(dto.estatisticas).toEqual({ servidos: 1, proximos: 7, desde: '2026-11-18' });
    expect(dto.trocasParaMim).toEqual([]);
    expect(dto.minhasTrocas).toEqual([]);
    expect(JSON.stringify(dto)).not.toContain(tokenYan);
  });

  it('link desconhecido ou de pessoa desativada → 404', async () => {
    expect((await request(amb.app).get('/api/eu/AAAAAAAAAAAAAAAAAAAAAAAA')).status).toBe(404);
    await amb.db.update(membros).set({ ativo: false }).where(eq(membros.id, 'yan'));
    expect((await request(amb.app).get(`/api/eu/${tokenYan}`)).status).toBe(404);
    await amb.db.update(membros).set({ ativo: true }).where(eq(membros.id, 'yan'));
  });
});

describe('confirmar / não consigo dessa vez', () => {
  it('confirma uma escala pendente e diz que não pode', async () => {
    const e = await escalaDe('herick', 'bn-estoril:2026-12-02:unico');
    await amb.db.update(escalas).set({ status: 'pendente' }).where(eq(escalas.id, e.id));
    const conf = await post(`/api/eu/${tokenHerick}/escalas/${e.id}/confirmar`);
    expect(conf.status).toBe(200);
    expect((conf.body as MinhaEscalaItemDTO)).toMatchObject({ escalaId: e.id, status: 'confirmado' });
    const nao = await post(`/api/eu/${tokenHerick}/escalas/${e.id}/nao-posso`);
    expect(nao.status).toBe(200);
    expect((nao.body as MinhaEscalaItemDTO).status).toBe('nao_pode');
    expect((nao.body as MinhaEscalaItemDTO).checkin.podeFazer).toBe(false);
    const [reg] = await amb.db.select().from(registros).where(and(eq(registros.acao, 'escala.nao_pode'), eq(registros.alvo, e.id)));
    expect(reg?.ator).toBe('membro:herick');
    await post(`/api/eu/${tokenHerick}/escalas/${e.id}/confirmar`);
  });

  it('não mexe na escala de outra pessoa nem em culto que já passou', async () => {
    const deOutro = await escalaDe('yan', 'bn-estoril:2026-11-22:noite');
    expect((await post(`/api/eu/${tokenHerick}/escalas/${deOutro.id}/confirmar`)).status).toBe(404);
    const passada = await escalaDe('herick', 'bn-estoril:2026-11-18:unico');
    const res = await post(`/api/eu/${tokenHerick}/escalas/${passada.id}/nao-posso`);
    expect(res.status).toBe(409);
    expect(res.body.erro).toBe('Esse culto já passou.');
  });
});

describe('POST /api/eu/:token/disponibilidade', () => {
  it('inscreve e desinscreve num culto do próprio ministério (vale também para ministério restrito)', async () => {
    await amb.db.update(ministerios).set({ acesso: 'restrito' }).where(eq(ministerios.id, 'altar'));
    const res = await post(`/api/eu/${tokenYan}/disponibilidade`, { cultoId: 'bn-estoril:2026-12-02:unico', ministerioId: 'altar', disponivel: true });
    expect(res.status).toBe(200);
    const dto = res.body as MinhaEscalaDTO;
    const item = dto.proximas.find((i) => i.culto.id === 'bn-estoril:2026-12-02:unico');
    expect(item?.status).toBe('confirmado');
    expect(dto.oportunidades.some((c) => c.id === 'bn-estoril:2026-12-02:unico')).toBe(false);
    const fora = await post(`/api/eu/${tokenYan}/disponibilidade`, { cultoId: 'bn-estoril:2026-12-02:unico', ministerioId: 'altar', disponivel: false });
    expect((fora.body as MinhaEscalaDTO).proximas.some((i) => i.culto.id === 'bn-estoril:2026-12-02:unico')).toBe(false);
    await amb.db.update(ministerios).set({ acesso: 'aberto' }).where(eq(ministerios.id, 'altar'));
  });

  it('ministério de que a pessoa não faz parte → 403; culto passado → 409', async () => {
    await amb.db.insert(ministerios).values({ id: 'louvor', unidadeId: 'bn-estoril', nome: 'Louvor', tokenPublico: 'tokenDoLouvorDeTeste1234' });
    const res = await post(`/api/eu/${tokenYan}/disponibilidade`, { cultoId: 'bn-estoril:2026-12-02:unico', ministerioId: 'louvor', disponivel: true });
    expect(res.status).toBe(403);
    const passado = await post(`/api/eu/${tokenYan}/disponibilidade`, { cultoId: 'bn-estoril:2026-11-22:manha', ministerioId: 'altar', disponivel: true });
    expect(passado.status).toBe(409);
  });
});

describe('trocas', () => {
  let escalaHerick: string;
  let trocaId: string;

  it('pedir: a escala vira "troca" e abre um pedido', async () => {
    escalaHerick = (await escalaDe('herick', 'bn-estoril:2026-12-09:unico')).id;
    const res = await post(`/api/eu/${tokenHerick}/escalas/${escalaHerick}/troca`, { mensagem: 'Vou viajar' });
    expect(res.status).toBe(201);
    const troca = res.body as TrocaDTO;
    trocaId = troca.id;
    expect(troca).toMatchObject({
      escalaId: escalaHerick, status: 'aberta', mensagem: 'Vou viajar', resolvidoEm: null,
      ministerio: { id: 'altar', nome: 'Altar' }, solicitante: { id: 'herick', nome: 'Herick' }, substituto: null,
    });
    expect(troca.culto.id).toBe('bn-estoril:2026-12-09:unico');
    expect((await escalaDe('herick', 'bn-estoril:2026-12-09:unico')).status).toBe('troca');
    const de_novo = await post(`/api/eu/${tokenHerick}/escalas/${escalaHerick}/troca`, {});
    expect(de_novo.status).toBe(409);

    const minha = (await request(amb.app).get(`/api/eu/${tokenHerick}`)).body as MinhaEscalaDTO;
    expect(minha.minhasTrocas.map((t) => t.id)).toEqual([trocaId]);
    const doYan = (await request(amb.app).get(`/api/eu/${tokenYan}`)).body as MinhaEscalaDTO;
    expect(doYan.trocasParaMim.map((t) => t.id)).toEqual([trocaId]);
    const publico = await request(amb.app).get(`/api/publico/${amb.tokenAltar}`);
    expect((publico.body.trocasAbertas as TrocaDTO[]).map((t) => t.id)).toEqual([trocaId]);
    // quem já está naquele culto não vê a troca como oportunidade
    const doThiago = (await request(amb.app).get(`/api/eu/${await tokenDoMembro(amb.db, 'thiago-daniel')}`)).body as MinhaEscalaDTO;
    expect(doThiago.trocasParaMim).toEqual([]);
  });

  it('cancelar: só quem pediu; a escala volta a confirmado', async () => {
    expect((await post(`/api/eu/${tokenYan}/trocas/${trocaId}/cancelar`)).status).toBe(403);
    const res = await post(`/api/eu/${tokenHerick}/trocas/${trocaId}/cancelar`);
    expect(res.status).toBe(200);
    expect((res.body as TrocaDTO).status).toBe('cancelada');
    expect((res.body as TrocaDTO).resolvidoEm).not.toBeNull();
    expect((await escalaDe('herick', 'bn-estoril:2026-12-09:unico')).status).toBe('confirmado');
    expect((await post(`/api/eu/${tokenHerick}/trocas/${trocaId}/cancelar`)).status).toBe(409);
  });

  it('aceitar: o substituto entra confirmado (origem troca) e a escala original vira "não pode"', async () => {
    const pedido = await post(`/api/eu/${tokenHerick}/escalas/${escalaHerick}/troca`, {});
    const id = (pedido.body as TrocaDTO).id;
    expect((await post(`/api/eu/${tokenHerick}/trocas/${id}/aceitar`)).status).toBe(400);
    const doThiago = await post(`/api/eu/${await tokenDoMembro(amb.db, 'thiago-daniel')}/trocas/${id}/aceitar`);
    expect(doThiago.status).toBe(409); // já está nesse culto

    const res = await post(`/api/eu/${tokenYan}/trocas/${id}/aceitar`);
    expect(res.status).toBe(200);
    const troca = res.body as TrocaDTO;
    expect(troca).toMatchObject({ status: 'aceita', substituto: { id: 'yan', nome: 'Yan' } });
    expect((await escalaDe('herick', 'bn-estoril:2026-12-09:unico')).status).toBe('nao_pode');
    const nova = await escalaDe('yan', 'bn-estoril:2026-12-09:unico');
    expect(nova).toMatchObject({ status: 'confirmado', origem: 'troca', papel: 'servo' });
    expect((await post(`/api/eu/${tokenLucas}/trocas/${id}/aceitar`)).status).toBe(409);
    const [linha] = await amb.db.select().from(trocas).where(eq(trocas.id, id));
    expect(linha?.substitutoId).toBe('yan');
  });

  it('aceitar troca de outro ministério → 403', async () => {
    await amb.db.insert(ministerioMembros).values({ ministerioId: 'louvor', membroId: 'lucas', papel: 'servo' });
    await amb.db.insert(escalas).values({ id: 'escala-louvor-1', cultoId: 'bn-estoril:2026-12-16:unico', ministerioId: 'louvor', membroId: 'lucas', status: 'confirmado' });
    const pedido = await post(`/api/eu/${tokenLucas}/escalas/escala-louvor-1/troca`, {});
    expect(pedido.status).toBe(201);
    const res = await post(`/api/eu/${tokenYan}/trocas/${(pedido.body as TrocaDTO).id}/aceitar`);
    expect(res.status).toBe(403);
  });
});

describe('check-in', () => {
  it('abre 2h antes, fecha 3h depois e vale uma vez só', async () => {
    const e = await escalaDe('herick', 'bn-estoril:2026-11-25:unico');
    const cedo = await post(`/api/eu/${tokenHerick}/escalas/${e.id}/checkin`);
    expect(cedo.status).toBe(409);
    expect(cedo.body.erro).toMatch(/abre 2 horas antes/);

    amb.definirAgora('2026-11-25T21:00:00Z'); // 18h em BH
    const item = (await request(amb.app).get(`/api/eu/${tokenHerick}`)).body.proximas[0] as MinhaEscalaItemDTO;
    expect(item.checkin.podeFazer).toBe(true);
    const ok = await post(`/api/eu/${tokenHerick}/escalas/${e.id}/checkin`);
    expect(ok.status).toBe(200);
    expect((ok.body as MinhaEscalaItemDTO).checkin).toMatchObject({ podeFazer: false, feitoEm: '2026-11-25T21:00:00.000Z' });
    const outra = await post(`/api/eu/${tokenHerick}/escalas/${e.id}/checkin`);
    expect(outra.status).toBe(409);

    amb.definirAgora('2026-11-26T02:00:00Z'); // 23h em BH: fechou
    const tarde = await post(`/api/eu/${await tokenDoMembro(amb.db, 'herbert')}/escalas/${(await escalaDe('herbert', 'bn-estoril:2026-11-25:unico')).id}/checkin`);
    expect(tarde.status).toBe(409);
    expect(tarde.body.erro).toMatch(/fechou/);
    amb.definirAgora('2026-11-25T15:00:00Z');
  });

  it('quem disse que não pode não faz check-in', async () => {
    amb.definirAgora('2026-11-25T21:00:00Z');
    const e = await escalaDe('herbert', 'bn-estoril:2026-11-25:unico');
    await amb.db.update(escalas).set({ status: 'nao_pode' }).where(eq(escalas.id, e.id));
    const res = await post(`/api/eu/${await tokenDoMembro(amb.db, 'herbert')}/escalas/${e.id}/checkin`);
    expect(res.status).toBe(409);
    amb.definirAgora('2026-11-25T15:00:00Z');
  });
});

describe('GET /api/eu/:token/agenda.ics', () => {
  it('entrega text/calendar com as próximas escalas (menos as de "não pode")', async () => {
    const res = await request(amb.app).get(`/api/eu/${tokenHerick}/agenda.ics`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/calendar; charset=utf-8');
    const ics = res.text;
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    const eventos = ics.split('BEGIN:VEVENT').length - 1;
    // próximas do Herick: 25/11, 02/12, 06/12, 16/12, 23/12, 30/12 (09/12 virou "não pode" com a troca)
    expect(eventos).toBe(6);
    expect(ics).toContain('DTSTART:20261125T223000Z');
    expect(ics).toContain('DTEND:20261126T003000Z');
    expect(ics).not.toContain('DTSTART:20261209');
    expect(ics).toMatch(/LOCATION:BN Estoril\\, Av\. Bar/);
    expect(ics.split('\r\n').every((linha) => Buffer.byteLength(linha, 'utf8') <= 75)).toBe(true);
  });
});
