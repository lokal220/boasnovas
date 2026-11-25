import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import type { CultoComEscalaDTO, EscalaPublicaDTO, MembroResumo } from '@shared/api';
import { cultos, escalas, membros, ministerios, registros } from '@shared/schema';
import { criarAmbiente, type Ambiente } from './_ambiente';

let amb: Ambiente;
const QUARTA = 'bn-estoril:2026-11-25:unico';
const DOMINGO_MANHA = 'bn-estoril:2026-11-29:manha';

beforeAll(async () => {
  amb = await criarAmbiente();
  await amb.db.update(membros).set({ telefone: '5531999990000' }).where(eq(membros.id, 'herick'));
});
afterAll(async () => { await amb.fechar(); });

const caminho = (resto = '') => `/api/publico/${amb.tokenAltar}${resto}`;
const marcar = (corpo: object, ip?: string) => {
  const r = request(amb.app).post(caminho('/disponibilidade')).set('X-BN', '1');
  if (ip) r.set('X-Forwarded-For', ip);
  return r.send(corpo);
};

describe('GET /api/publico/:token', () => {
  it('monta a escala do altar com os dados reais', async () => {
    const res = await request(amb.app).get(caminho());
    expect(res.status).toBe(200);
    const dto = res.body as EscalaPublicaDTO;
    expect(dto.igreja.nome).toBe('Boas Novas Church');
    expect(dto.unidade).toEqual({ id: 'bn-estoril', nome: 'BN Estoril', endereco: 'Av. Barão Homem de Melo, 2588, Estoril · BH', fusoHorario: 'America/Sao_Paulo' });
    expect(dto.hoje).toBe('2026-11-25');
    expect(dto.ministerio).toMatchObject({ id: 'altar', nome: 'Altar', descricao: 'Homens que servem no altar', vagasPadrao: 3, acesso: 'aberto', ativo: true });
    expect(dto.ministerio.horarios).toHaveLength(4);
    expect(dto.membros).toHaveLength(20);
    expect(dto.membros.map((m) => m.nome)).toEqual([...dto.membros.map((m) => m.nome)].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
    expect(dto.membros.find((m) => m.id === 'romulo')?.papel).toBe('lider');
    expect(dto.cultos).toHaveLength(25);
    expect(dto.cultos.map((c) => c.data)).toEqual([...dto.cultos.map((c) => c.data)].sort());
    expect(dto.trocasAbertas).toEqual([]);

    const primeiro = dto.cultos[0]!;
    expect(primeiro).toMatchObject({ id: 'bn-estoril:2026-11-18:unico', data: '2026-11-18', hora: '19h30', turno: 'unico', extra: false, vespera: null, ministerioId: 'altar', vagas: 3 });
    expect(primeiro.escalados.map((e) => `${e.nome}:${e.papel}`)).toEqual(['Rômulo:lider', 'Thiago Daniel:servo', 'Herick:servo', 'Daniel:servo', 'Alê:servo']);
    expect(primeiro.cobertura).toEqual({ pessoas: 5, confirmados: 5, pendentes: 0, trocas: 0, vagas: 3, faltam: 0, status: 'completo' });
    const ceia = dto.cultos.find((c) => c.id === 'bn-estoril:2026-12-06:manha')!;
    expect(ceia.titulo).toBe('Santa Ceia');
    expect(ceia.hora).toBe('10h');
    const vazio = dto.cultos.find((c) => c.id === 'bn-estoril:2026-12-27:manha')!;
    expect(vazio.escalados).toEqual([]);
    expect(vazio.cobertura).toMatchObject({ pessoas: 0, faltam: 3, status: 'vazio' });
  });

  it('não vaza telefone, tokens nem dados internos', async () => {
    const res = await request(amb.app).get(caminho());
    const texto = JSON.stringify(res.body);
    const linhas = await amb.db.select({ token: membros.tokenAcesso, telefone: membros.telefone }).from(membros);
    for (const l of linhas) {
      expect(texto).not.toContain(l.token);
      if (l.telefone) expect(texto).not.toContain(l.telefone);
    }
    expect(texto).not.toContain(amb.tokenAltar);
    expect(texto).not.toMatch(/"telefone"|"tokenAcesso"|"tokenPublico"|"linkPessoal"|"linkPublico"|"apelidos"/);
    for (const m of res.body.membros as MembroResumo[]) expect(Object.keys(m).sort()).toEqual(['id', 'nome', 'papel']);
  });

  it('não mostra a terça 14h (o altar não atende) e mostra culto extra com véspera', async () => {
    const agente = request(amb.app);
    await amb.db.insert(cultos).values([
      { id: 'bn-estoril:2026-12-01:tarde', unidadeId: 'bn-estoril', data: '2026-12-01', hora: '14h', turno: 'tarde' },
      { id: 'bn-estoril:2026-12-24:unico', unidadeId: 'bn-estoril', data: '2026-12-24', hora: '22h', turno: 'unico', titulo: 'Vigília', extra: true },
    ]);
    const dto = (await agente.get(caminho())).body as EscalaPublicaDTO;
    expect(dto.cultos.some((c) => c.id === 'bn-estoril:2026-12-01:tarde')).toBe(false);
    const vigilia = dto.cultos.find((c) => c.id === 'bn-estoril:2026-12-24:unico');
    expect(vigilia).toMatchObject({ extra: true, vespera: '2026-12-23', titulo: 'Vigília' });
    await amb.db.delete(cultos).where(eq(cultos.id, 'bn-estoril:2026-12-01:tarde'));
    await amb.db.delete(cultos).where(eq(cultos.id, 'bn-estoril:2026-12-24:unico'));
  });

  it('token desconhecido, malformado ou de ministério desativado → 404', async () => {
    expect((await request(amb.app).get('/api/publico/AAAAAAAAAAAAAAAAAAAAAAAA')).status).toBe(404);
    expect((await request(amb.app).get('/api/publico/x')).status).toBe(404);
    await amb.db.update(ministerios).set({ ativo: false }).where(eq(ministerios.id, 'altar'));
    const res = await request(amb.app).get(caminho());
    expect(res.status).toBe(404);
    expect(res.body.erro).toMatch(/link/);
    await amb.db.update(ministerios).set({ ativo: true }).where(eq(ministerios.id, 'altar'));
  });
});

describe('POST /api/publico/:token/disponibilidade', () => {
  it('marcar cria escala confirmada (voluntário) e desmarcar apaga', async () => {
    const res = await marcar({ membroId: 'yan', cultoId: QUARTA, disponivel: true });
    expect(res.status).toBe(200);
    const culto = res.body as CultoComEscalaDTO;
    expect(culto.id).toBe(QUARTA);
    const yan = culto.escalados.find((e) => e.membroId === 'yan');
    expect(yan).toMatchObject({ nome: 'Yan', papel: 'servo', status: 'confirmado', origem: 'voluntario', checkinEm: null });
    expect(culto.escalados.at(-1)?.membroId).toBe('yan'); // entra no fim da lista
    expect(culto.cobertura.pessoas).toBe(6);

    const repetido = await marcar({ membroId: 'yan', cultoId: QUARTA, disponivel: true });
    expect(repetido.status).toBe(200);
    expect((repetido.body as CultoComEscalaDTO).escalados.filter((e) => e.membroId === 'yan')).toHaveLength(1);

    const desmarcar = await marcar({ membroId: 'yan', cultoId: QUARTA, disponivel: false });
    expect(desmarcar.status).toBe(200);
    expect((desmarcar.body as CultoComEscalaDTO).escalados.some((e) => e.membroId === 'yan')).toBe(false);
    const linhas = await amb.db.select().from(escalas).where(and(eq(escalas.cultoId, QUARTA), eq(escalas.membroId, 'yan')));
    expect(linhas).toHaveLength(0);

    const regs = await amb.db.select().from(registros).where(eq(registros.acao, 'disponibilidade.marcar'));
    expect(regs.length).toBeGreaterThan(0);
    expect(regs[0]!.ator).toMatch(/^anonimo:[0-9a-f]{16}$/);
    expect(regs[0]!.ministerioId).toBe('altar');
  });

  it('desmarcar uma escala dada pelo líder vira "não pode" (não apaga)', async () => {
    const res = await marcar({ membroId: 'herick', cultoId: QUARTA, disponivel: false });
    expect(res.status).toBe(200);
    const herick = (res.body as CultoComEscalaDTO).escalados.find((e) => e.membroId === 'herick');
    expect(herick).toMatchObject({ status: 'nao_pode', origem: 'importacao' });
    expect((res.body as CultoComEscalaDTO).cobertura.pessoas).toBe(4);
    const volta = await marcar({ membroId: 'herick', cultoId: QUARTA, disponivel: true });
    expect((volta.body as CultoComEscalaDTO).escalados.find((e) => e.membroId === 'herick')?.status).toBe('confirmado');
  });

  it('recusa culto que já passou, membro de fora, culto inexistente e culto que o ministério não atende', async () => {
    const passado = await marcar({ membroId: 'yan', cultoId: 'bn-estoril:2026-11-22:manha', disponivel: true });
    expect(passado.status).toBe(409);
    expect(passado.body.erro).toBe('Esse culto já passou.');

    amb.definirAgora('2026-11-25T23:00:00Z'); // 20h em BH: o culto de 19h30 já começou
    const comecou = await marcar({ membroId: 'yan', cultoId: QUARTA, disponivel: true });
    expect(comecou.status).toBe(409);
    amb.definirAgora('2026-11-25T15:00:00Z');

    expect((await marcar({ membroId: 'ninguem', cultoId: QUARTA, disponivel: true })).status).toBe(404);
    expect((await marcar({ membroId: 'yan', cultoId: 'bn-estoril:2030-01-01:manha', disponivel: true })).status).toBe(404);
    await amb.db.insert(cultos).values({ id: 'bn-estoril:2026-12-01:tarde', unidadeId: 'bn-estoril', data: '2026-12-01', hora: '14h', turno: 'tarde' });
    expect((await marcar({ membroId: 'yan', cultoId: 'bn-estoril:2026-12-01:tarde', disponivel: true })).status).toBe(404);
    await amb.db.delete(cultos).where(eq(cultos.id, 'bn-estoril:2026-12-01:tarde'));
    const invalido = await marcar({ membroId: 'yan', cultoId: QUARTA });
    expect(invalido.status).toBe(400);
  });

  it('membro desativado não aparece e não marca', async () => {
    await amb.db.update(membros).set({ ativo: false }).where(eq(membros.id, 'silas'));
    const dto = (await request(amb.app).get(caminho())).body as EscalaPublicaDTO;
    expect(dto.membros.some((m) => m.id === 'silas')).toBe(false);
    expect((await marcar({ membroId: 'silas', cultoId: DOMINGO_MANHA, disponivel: true })).status).toBe(404);
    await amb.db.update(membros).set({ ativo: true }).where(eq(membros.id, 'silas'));
  });

  it('exige o cabeçalho X-BN', async () => {
    const res = await request(amb.app).post(caminho('/disponibilidade')).send({ membroId: 'yan', cultoId: QUARTA, disponivel: true });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/publico/:token/membros ("não estou na lista")', () => {
  it('cria a pessoa no ministério (201) e devolve a existente pelo nome (200)', async () => {
    const novo = await request(amb.app).post(caminho('/membros')).set('X-BN', '1').send({ nome: 'pedro henrique' });
    expect(novo.status).toBe(201);
    expect(novo.body).toEqual({ id: 'pedro-henrique', nome: 'Pedro Henrique', papel: 'servo' });
    const dto = (await request(amb.app).get(caminho())).body as EscalaPublicaDTO;
    expect(dto.membros.some((m) => m.id === 'pedro-henrique')).toBe(true);

    const existente = await request(amb.app).post(caminho('/membros')).set('X-BN', '1').send({ nome: 'HERICK' });
    expect(existente.status).toBe(200);
    expect(existente.body).toEqual({ id: 'herick', nome: 'Herick', papel: 'servo' });
    const apelido = await request(amb.app).post(caminho('/membros')).set('X-BN', '1').send({ nome: 'Jônatas' });
    expect(apelido.body.id).toBe('joe');

    const curto = await request(amb.app).post(caminho('/membros')).set('X-BN', '1').send({ nome: 'a' });
    expect(curto.status).toBe(400);
    expect(curto.body.erro).toBe('Escreva o nome.');
  });
});

describe('ministério restrito', () => {
  it('só pelo link pessoal: disponibilidade e novo membro → 403 (a escala continua visível)', async () => {
    await amb.db.update(ministerios).set({ acesso: 'restrito' }).where(eq(ministerios.id, 'altar'));
    expect((await request(amb.app).get(caminho())).status).toBe(200);
    const res = await marcar({ membroId: 'yan', cultoId: QUARTA, disponivel: true });
    expect(res.status).toBe(403);
    expect(res.body.erro).toMatch(/próprio link/);
    expect((await request(amb.app).post(caminho('/membros')).set('X-BN', '1').send({ nome: 'Fulano de Tal' })).status).toBe(403);
    await amb.db.update(ministerios).set({ acesso: 'aberto' }).where(eq(ministerios.id, 'altar'));
  });
});

describe('limite das rotas públicas', () => {
  it('60 alterações a cada 10 minutos por IP (a leitura não conta)', async () => {
    const ip = '198.51.100.23';
    for (let i = 0; i < 60; i++) {
      const res = await marcar({ membroId: 'yan', cultoId: DOMINGO_MANHA, disponivel: i % 2 === 0 }, ip);
      expect(res.status).toBe(200);
    }
    const bloqueado = await marcar({ membroId: 'yan', cultoId: DOMINGO_MANHA, disponivel: true }, ip);
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.erro).toMatch(/Muitas alterações/);
    const leitura = await request(amb.app).get(caminho()).set('X-Forwarded-For', ip);
    expect(leitura.status).toBe(200);
  });
});
