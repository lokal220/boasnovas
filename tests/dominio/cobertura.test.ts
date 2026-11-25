import { describe, expect, it } from 'vitest';
import type { StatusEscala } from '@shared/api';
import { VAGAS_PADRAO, calcularCobertura } from '@shared/dominio';

const com = (...status: StatusEscala[]) => status.map((s) => ({ status: s }));

describe('calcularCobertura', () => {
  it('ninguém: vazio e faltam todas as vagas', () => {
    expect(calcularCobertura([], 3)).toEqual({ pessoas: 0, confirmados: 0, pendentes: 0, trocas: 0, vagas: 3, faltam: 3, status: 'vazio' });
  });
  it('nao_pode não conta como pessoa', () => {
    expect(calcularCobertura(com('confirmado', 'confirmado', 'nao_pode'), 3)).toEqual({
      pessoas: 2, confirmados: 2, pendentes: 0, trocas: 0, vagas: 3, faltam: 1, status: 'parcial',
    });
    expect(calcularCobertura(com('nao_pode', 'nao_pode'), 3).status).toBe('vazio');
  });
  it('confirmado + pendente + troca contam para completar', () => {
    expect(calcularCobertura(com('confirmado', 'pendente', 'troca'), 3)).toEqual({
      pessoas: 3, confirmados: 1, pendentes: 1, trocas: 1, vagas: 3, faltam: 0, status: 'completo',
    });
  });
  it('acima das vagas continua completo e sem faltar ninguém', () => {
    const c = calcularCobertura(com('confirmado', 'confirmado', 'confirmado', 'confirmado', 'confirmado', 'confirmado'), 3);
    expect(c.status).toBe('completo');
    expect(c.faltam).toBe(0);
    expect(c.pessoas).toBe(6);
  });
  it('vagas: 0 já é completo; inválidas usam o padrão; decimais e negativas são ajustadas', () => {
    expect(calcularCobertura([], 0).status).toBe('completo');
    expect(calcularCobertura([], Number.NaN).vagas).toBe(VAGAS_PADRAO);
    expect(calcularCobertura([], Number.POSITIVE_INFINITY).vagas).toBe(3);
    expect(calcularCobertura([], 2.7).vagas).toBe(2);
    expect(calcularCobertura([], -4)).toMatchObject({ vagas: 0, faltam: 0, status: 'completo' });
    expect(VAGAS_PADRAO).toBe(3);
  });
  it('ignora status desconhecido e aceita EscaladoDTO completo', () => {
    expect(calcularCobertura([{ status: 'talvez' }, { status: 'confirmado' }], 2)).toMatchObject({ pessoas: 1, status: 'parcial' });
    const escalado = { escalaId: 'e1', membroId: 'herick', nome: 'Herick', papel: 'lider' as const, funcao: '', status: 'pendente' as const, origem: 'lider' as const, checkinEm: null };
    expect(calcularCobertura([escalado], 1)).toMatchObject({ pessoas: 1, pendentes: 1, status: 'completo' });
  });
});
