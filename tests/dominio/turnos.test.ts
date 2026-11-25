import { describe, expect, it } from 'vitest';
import { EVENTOS_CONHECIDOS, ORDEM_TURNOS, TURNOS, compararCultos, ehTurno, nomeTurno, normalizarEvento, turnoPorHora } from '@shared/dominio';

describe('TURNOS', () => {
  it('tem os quatro turnos com os nomes do SPEC', () => {
    expect(TURNOS.manha.nome).toBe('Manhã');
    expect(TURNOS.tarde.nome).toBe('Tarde');
    expect(TURNOS.noite.nome).toBe('Noite');
    expect(TURNOS.unico.nome).toBe('Culto');
    expect(TURNOS.manha.horaPadrao).toBe('10h');
    expect(TURNOS.tarde.horaPadrao).toBe('17h');
    expect(TURNOS.noite.horaPadrao).toBe('19h30');
    expect(Object.isFrozen(TURNOS) && Object.isFrozen(TURNOS.manha)).toBe(true);
    expect([...ORDEM_TURNOS]).toEqual(['unico', 'manha', 'tarde', 'noite']);
  });
  it('ehTurno e nomeTurno', () => {
    expect(ehTurno('manha')).toBe(true);
    expect(ehTurno('madrugada')).toBe(false);
    expect(ehTurno('toString')).toBe(false);
    expect(ehTurno(1)).toBe(false);
    expect(nomeTurno('unico')).toBe('Culto');
    expect(nomeTurno('noite')).toBe('Noite');
    expect(nomeTurno('outro')).toBe('outro');
  });
});

describe('turnoPorHora', () => {
  it('antes das 12h manhã, antes das 18h tarde, senão noite', () => {
    expect(turnoPorHora('10h')).toBe('manha');
    expect(turnoPorHora('11h59')).toBe('manha');
    expect(turnoPorHora('12h')).toBe('tarde');
    expect(turnoPorHora('14h')).toBe('tarde');
    expect(turnoPorHora('17h')).toBe('tarde');
    expect(turnoPorHora('17h59')).toBe('tarde');
    expect(turnoPorHora('18h')).toBe('noite');
    expect(turnoPorHora('19h30')).toBe('noite');
    expect(turnoPorHora('19:30')).toBe('noite');
  });
  it('aceita número em horas (< 24) ou em minutos (≥ 24)', () => {
    expect(turnoPorHora(10)).toBe('manha');
    expect(turnoPorHora(17)).toBe('tarde');
    expect(turnoPorHora(19.5)).toBe('noite');
    expect(turnoPorHora(600)).toBe('manha');
    expect(turnoPorHora(1170)).toBe('noite');
  });
  it('hora não reconhecida vira culto único', () => {
    expect(turnoPorHora('')).toBe('unico');
    expect(turnoPorHora('de manhã')).toBe('unico');
    expect(turnoPorHora(-5)).toBe('unico');
    expect(turnoPorHora(Number.NaN)).toBe('unico');
  });
});

describe('compararCultos', () => {
  it('ordena por data, hora (ou hora de costume do turno), ordem do turno e id', () => {
    const cultos = [
      { id: 'c', data: '2026-11-29', turno: 'noite' },
      { id: 'a', data: '2026-11-29', turno: 'manha' },
      { id: 'x', data: '2026-11-25', turno: 'unico', hora: '19h30' },
      { id: 'b', data: '2026-11-29', turno: 'tarde' },
      { id: 'e', data: '2026-11-29', turno: 'unico', hora: '15h' },
      { id: 'd', data: '2026-11-22', turno: 'noite', hora: '19h30' },
    ];
    expect([...cultos].sort(compararCultos).map((c) => c.id)).toEqual(['d', 'x', 'a', 'e', 'b', 'c']);
  });
  it('desempata pelo turno e depois pelo id (números em ordem natural)', () => {
    const mesmos = [
      { id: 'bn:2026-11-29:noite-10', data: '2026-11-29', turno: 'noite' },
      { id: 'bn:2026-11-29:noite-2', data: '2026-11-29', turno: 'noite' },
      { id: 'bn:2026-11-29:unico', data: '2026-11-29', turno: 'unico', hora: '19h30' },
    ];
    expect([...mesmos].sort(compararCultos).map((c) => c.id)).toEqual(['bn:2026-11-29:unico', 'bn:2026-11-29:noite-2', 'bn:2026-11-29:noite-10']);
  });
  it('turno desconhecido sem hora vai para o fim do dia', () => {
    const lista = [{ data: '2026-11-29', turno: 'x' }, { data: '2026-11-29', turno: 'noite' }];
    expect([...lista].sort(compararCultos)[0]!.turno).toBe('noite');
    expect(compararCultos({ data: '2026-11-29', turno: 'manha' }, { data: '2026-11-29', turno: 'manha' })).toBe(0);
  });
});

describe('eventos', () => {
  it('normalizarEvento entende os eventos conhecidos e limpa o texto livre', () => {
    const casos: Record<string, string> = {
      ' CEIA ': 'Santa Ceia', '( CEIA )': 'Santa Ceia', 'Santa ceia': 'Santa Ceia', '( Natal )': 'Natal',
      'Réveillon': 'Réveillon', 'REVEILLON': 'Réveillon', '( Réveillon)': 'Réveillon', 'Virada': 'Réveillon',
      'vigília': 'Vigília', 'batismo': 'Batismo', '*Natal*': 'Natal', 'Culto de Jovens': 'Culto de Jovens',
      'culto de jovens': 'Culto de jovens', '': '', '  ': '', '()': '',
    };
    for (const [entrada, saida] of Object.entries(casos)) expect(normalizarEvento(entrada), entrada).toBe(saida);
    expect(normalizarEvento(null)).toBe('');
    expect(normalizarEvento('constructor')).toBe('Constructor');
    expect(normalizarEvento('__proto__')).toBe('Proto');
  });
  it('EVENTOS_CONHECIDOS é congelado', () => {
    expect(Object.isFrozen(EVENTOS_CONHECIDOS)).toBe(true);
    expect(EVENTOS_CONHECIDOS['santa ceia']).toBe('Santa Ceia');
  });
});
