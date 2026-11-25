import { describe, expect, it } from 'vitest';
import type { AgendaFixaDTO } from '@shared/api';
import { AGENDA_ALTAR, AGENDA_BN_ESTORIL, agendaDoMinisterio, datasDoMes, diaSemana, ehDiaFixo, idCulto, vespera } from '@shared/dominio';

const agendaDoBanco: AgendaFixaDTO[] = [
  { id: 1, diaSemana: 0, hora: '10h', turno: 'manha', rotulo: '', ativo: true },
  { id: 2, diaSemana: 0, hora: '17h', turno: 'tarde', rotulo: '', ativo: true },
  { id: 3, diaSemana: 0, hora: '19h30', turno: 'noite', rotulo: '', ativo: true },
  { id: 4, diaSemana: 2, hora: '14h', turno: 'tarde', rotulo: 'tarde da benção', ativo: true },
  { id: 5, diaSemana: 3, hora: '19h30', turno: 'unico', rotulo: '', ativo: true },
  { id: 6, diaSemana: 5, hora: '20h', turno: 'noite', rotulo: 'desativado', ativo: false },
];

describe('datasDoMes', () => {
  it('janeiro de 2027 com a agenda do altar tem 19 ocorrências (4 quartas + 5 domingos × 3)', () => {
    const r = datasDoMes(2027, 1, AGENDA_ALTAR);
    expect(r).toHaveLength(19);
    expect(r.filter((o) => o.turno === 'unico').map((o) => o.data)).toEqual(['2027-01-06', '2027-01-13', '2027-01-20', '2027-01-27']);
    expect(r.slice(0, 3)).toEqual([
      { data: '2027-01-03', hora: '10h', turno: 'manha', rotulo: '', agendaId: null },
      { data: '2027-01-03', hora: '17h', turno: 'tarde', rotulo: '', agendaId: null },
      { data: '2027-01-03', hora: '19h30', turno: 'noite', rotulo: '', agendaId: null },
    ]);
    expect(r.every((o) => [0, 3].includes(diaSemana(o.data)))).toBe(true);
    expect(r.at(-1)).toMatchObject({ data: '2027-01-31', turno: 'noite' });
  });
  it('usa os ids e rótulos da agenda do banco e pula horários inativos', () => {
    const r = datasDoMes(2026, 11, agendaDoBanco);
    expect(r).toHaveLength(15 + 4 + 4); // 5 domingos × 3, 4 terças, 4 quartas
    expect(r.find((o) => o.data === '2026-11-24')).toEqual({ data: '2026-11-24', hora: '14h', turno: 'tarde', rotulo: 'tarde da benção', agendaId: 4 });
    expect(r.some((o) => o.agendaId === 6)).toBe(false);
    expect(datasDoMes(2026, 11, AGENDA_BN_ESTORIL)).toHaveLength(23);
  });
  it('fevereiro não bissexto e mês inválido', () => {
    expect(datasDoMes(2027, 2, AGENDA_ALTAR)).toHaveLength(4 + 4 * 3);
    expect(datasDoMes(2028, 2, [{ diaSemana: 2, hora: '14h', turno: 'tarde' }]).map((o) => o.data).at(-1)).toBe('2028-02-29');
    expect(datasDoMes(2027, 13, AGENDA_ALTAR)).toEqual([]);
    expect(datasDoMes(2027, 0, AGENDA_ALTAR)).toEqual([]);
    expect(datasDoMes(2027.5, 1, AGENDA_ALTAR)).toEqual([]);
    expect(datasDoMes(2027, 1, [])).toEqual([]);
  });
});

describe('agendaDoMinisterio', () => {
  it('lista vazia de horários = todos os ativos; com ids filtra', () => {
    expect(agendaDoMinisterio(agendaDoBanco).map((h) => h.id)).toEqual([1, 2, 3, 4, 5]);
    expect(agendaDoMinisterio(agendaDoBanco, [5, 1, 2, 3]).map((h) => h.id)).toEqual([1, 2, 3, 5]);
    expect(agendaDoMinisterio(agendaDoBanco, [6])).toEqual([]);
    expect(agendaDoMinisterio(AGENDA_ALTAR, [1])).toEqual([]);
  });
});

describe('vespera, ehDiaFixo e idCulto', () => {
  it('vespera é o dia anterior', () => {
    expect(vespera('2026-12-24')).toBe('2026-12-23');
    expect(vespera('2027-01-01')).toBe('2026-12-31');
    expect(vespera('2028-03-01')).toBe('2028-02-29');
  });
  it('ehDiaFixo segue a agenda (padrão: quarta e domingo do altar)', () => {
    expect(ehDiaFixo('2026-11-25')).toBe(true);
    expect(ehDiaFixo('2026-11-29')).toBe(true);
    expect(ehDiaFixo('2026-12-24')).toBe(false);
    expect(ehDiaFixo('2026-11-24')).toBe(false);
    expect(ehDiaFixo('2026-11-24', agendaDoBanco)).toBe(true);
    expect(ehDiaFixo('2026-11-27', agendaDoBanco)).toBe(false); // sexta inativa
  });
  it('idCulto monta o id e acrescenta sufixo quando repete', () => {
    expect(idCulto('bn-estoril', '2026-11-22', 'manha')).toBe('bn-estoril:2026-11-22:manha');
    expect(idCulto('bn-estoril', '2026-11-22', 'manha', [])).toBe('bn-estoril:2026-11-22:manha');
    expect(idCulto('bn-estoril', '2026-11-22', 'manha', ['bn-estoril:2026-11-22:manha'])).toBe('bn-estoril:2026-11-22:manha-2');
    const usados = new Set(['bn-estoril:2026-12-24:unico', 'bn-estoril:2026-12-24:unico-2']);
    expect(idCulto('bn-estoril', '2026-12-24', 'unico', usados)).toBe('bn-estoril:2026-12-24:unico-3');
  });
  it('agendas padrão são congeladas', () => {
    expect(Object.isFrozen(AGENDA_ALTAR)).toBe(true);
    expect(AGENDA_ALTAR).toHaveLength(4);
    expect(AGENDA_BN_ESTORIL.find((h) => h.diaSemana === 2)?.rotulo).toBe('tarde da benção');
  });
});
