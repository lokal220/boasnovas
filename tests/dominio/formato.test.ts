import { describe, expect, it } from 'vitest';
import type { StatusEscala } from '@shared/api';
import {
  calcularCobertura, diaDaAgenda, diaDaFrase, diaPorExtenso, fichaAgenda, overlineData, rotuloAguardando, rotuloCobertura, rotuloCulto,
  rotuloFaltam, rotuloStatus,
} from '@shared/dominio';

describe('fichaAgenda (Função · BN Unidade · Dia | hora)', () => {
  it('domingo e quarta como a igreja escreve', () => {
    expect(fichaAgenda({ funcao: 'Altar', unidade: 'BN Estoril', data: '2026-11-29', hora: '10h' })).toBe('Altar · BN Estoril · Dom | 10h');
    expect(fichaAgenda({ funcao: 'Altar', unidade: 'BN Estoril', data: '2026-11-25', hora: '19h30' })).toBe('Altar · BN Estoril · Quarta | 19h30');
  });
  it('ministério e função juntos, sem função, sem hora', () => {
    expect(fichaAgenda({ ministerio: 'Louvor', funcao: 'Teclado', unidade: 'BN Estoril', data: '2026-11-29', hora: '10h' }))
      .toBe('Louvor · Teclado · BN Estoril · Dom | 10h');
    expect(fichaAgenda({ unidade: 'BN Estoril', data: '2026-11-24', hora: '14h' })).toBe('BN Estoril · Terça | 14h');
    expect(fichaAgenda({ funcao: 'Altar', unidade: 'BN Estoril', data: '2026-12-24' })).toBe('Altar · BN Estoril · Quinta');
    expect(fichaAgenda({ funcao: '*Altar*', unidade: ' BN  Estoril ', data: '2026-12-24', hora: '' })).toBe('Altar · BN Estoril · Quinta');
  });
  it('nomes dos dias: Dom, Segunda, Terça, Quarta, Quinta, Sexta, Sábado', () => {
    const semana = ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'];
    expect(semana.map(diaDaAgenda)).toEqual(['Dom', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);
    expect(semana.map(diaDaFrase)).toEqual(['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']);
    expect(diaPorExtenso('2026-11-25')).toBe('quarta-feira');
    expect(diaPorExtenso('2026-11-29')).toBe('domingo');
  });
});

describe('rotuloStatus', () => {
  it('rótulos e tons do SPEC', () => {
    expect(rotuloStatus('confirmado')).toEqual({ rotulo: 'confirmado', tom: 'ok' });
    expect(rotuloStatus('pendente')).toEqual({ rotulo: 'aguardando você', tom: 'wait' });
    expect(rotuloStatus('nao_pode')).toEqual({ rotulo: 'não pode', tom: 'no' });
    expect(rotuloStatus('troca')).toEqual({ rotulo: 'troca pedida', tom: 'swap' });
  });
  it('visão do líder e status desconhecido', () => {
    expect(rotuloStatus('pendente', 'lider')).toEqual({ rotulo: 'aguardando', tom: 'wait' });
    expect(rotuloStatus('confirmado', 'lider')).toEqual({ rotulo: 'confirmado', tom: 'ok' });
    expect(rotuloStatus('constructor' as StatusEscala)).toEqual({ rotulo: 'constructor', tom: 'wait' });
  });
  it('devolve cópia (não deixa alterar a tabela interna)', () => {
    const r = rotuloStatus('confirmado');
    r.rotulo = 'x';
    expect(rotuloStatus('confirmado').rotulo).toBe('confirmado');
  });
});

describe('rótulos de cobertura', () => {
  const cob = (status: StatusEscala[], vagas: number) => calcularCobertura(status.map((s) => ({ status: s })), vagas);
  it('rotuloCobertura usa os confirmados', () => {
    expect(rotuloCobertura(cob(['confirmado', 'confirmado', 'confirmado'], 4))).toBe('3 de 4 confirmados');
    expect(rotuloCobertura(cob([], 3))).toBe('0 de 3 confirmados');
    expect(rotuloCobertura(cob(['confirmado'], 1))).toBe('1 de 1 confirmado');
    expect(rotuloCobertura(cob(['confirmado', 'confirmado', 'confirmado', 'confirmado', 'confirmado'], 3))).toBe('5 confirmados (3 vagas)');
    expect(rotuloCobertura(cob(['confirmado', 'confirmado'], 1))).toBe('2 confirmados (1 vaga)');
    expect(rotuloCobertura(cob(['confirmado', 'confirmado'], 0))).toBe('2 confirmados');
    expect(rotuloCobertura(cob(['confirmado'], 0))).toBe('1 confirmado');
  });
  it('"1 aguardando" quando houver pendentes', () => {
    const c = cob(['confirmado', 'confirmado', 'pendente'], 4);
    expect(rotuloCobertura(c, { comAguardando: true })).toBe('2 de 4 confirmados · 1 aguardando');
    expect(rotuloCobertura(c)).toBe('2 de 4 confirmados');
    expect(rotuloAguardando(c)).toBe('1 aguardando');
    expect(rotuloAguardando(cob(['pendente', 'pendente'], 4))).toBe('2 aguardando');
    expect(rotuloAguardando(cob(['confirmado'], 4))).toBe('');
    expect(rotuloCobertura(cob(['confirmado'], 4), { comAguardando: true })).toBe('1 de 4 confirmados');
  });
  it('rotuloFaltam', () => {
    expect(rotuloFaltam(cob(['confirmado', 'confirmado', 'confirmado'], 3))).toBe('Completo');
    expect(rotuloFaltam(cob(['confirmado', 'confirmado'], 3))).toBe('Falta 1');
    expect(rotuloFaltam(cob(['confirmado'], 3))).toBe('Faltam 2');
    expect(rotuloFaltam(cob([], 3))).toBe('Sem ninguém');
  });
});

describe('rótulos de culto e de data', () => {
  it('rotuloCulto', () => {
    expect(rotuloCulto({ data: '2026-11-22', turno: 'manha' })).toBe('Dom 22/11 · Manhã');
    expect(rotuloCulto({ data: '2026-11-25', turno: 'unico' })).toBe('Qua 25/11');
    expect(rotuloCulto({ data: '2026-12-06', turno: 'noite', titulo: 'Santa Ceia' }, { comTitulo: true })).toBe('Dom 06/12 · Noite · Santa Ceia');
    expect(rotuloCulto({ data: '2026-12-24', turno: 'unico', titulo: 'Vigília' }, { comTitulo: true })).toBe('Qui 24/12 · Vigília');
    expect(rotuloCulto({ data: '2026-12-24', turno: 'unico', titulo: 'Vigília' })).toBe('Qui 24/12');
  });
  it('overlineData no formato do card de escala', () => {
    expect(overlineData('2026-11-29')).toBe('domingo · 29 nov');
    expect(overlineData('2026-11-24')).toBe('terça · 24 nov');
    expect(overlineData('2026-12-06')).toBe('domingo · 6 dez');
  });
});
