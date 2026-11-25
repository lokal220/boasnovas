import { describe, expect, it } from 'vitest';
import {
  CHECKIN_ABRE_ANTES_MINUTOS, CHECKIN_FECHA_DEPOIS_MINUTOS, FUSO_PADRAO, dataISO, dataValida, deslocamentoFuso, diaSemana, diasEntre,
  formatarDDMM, formatarDDMMAAAA, fusoValido, hojeNoFuso, horaParaMinutos, instanteDoCulto, janelaCheckin, minutosParaHora,
  nomeDia, nomeDiaCurto, nomeMes, nomeMesCurto, partesData, rotuloRelativo, somarDias,
} from '@shared/dominio';

describe('datas de culto (AAAA-MM-DD)', () => {
  it('FUSO_PADRAO é o de São Paulo', () => {
    expect(FUSO_PADRAO).toBe('America/Sao_Paulo');
  });
  it('dataISO monta e rola datas fora do calendário', () => {
    expect(dataISO(2026, 11, 22)).toBe('2026-11-22');
    expect(dataISO(2026, 1, 32)).toBe('2026-02-01');
    expect(dataISO(2026, 13, 1)).toBe('2027-01-01');
  });
  it('dataValida', () => {
    expect(dataValida('2026-02-28')).toBe(true);
    expect(dataValida('2028-02-29')).toBe(true);
    expect(dataValida('2027-02-29')).toBe(false);
    expect(dataValida('2026-02-30')).toBe(false);
    expect(dataValida('2026-1-1')).toBe(false);
    expect(dataValida('22/11/2026')).toBe(false);
    expect(dataValida(20261122)).toBe(false);
    expect(dataValida(null)).toBe(false);
  });
  it('partesData e erro para data inválida', () => {
    expect(partesData('2026-11-22')).toEqual({ ano: 2026, mes: 11, dia: 22 });
    expect(() => partesData('2026-13-01')).toThrow(TypeError);
  });
  it('diaSemana (0 = domingo)', () => {
    expect(diaSemana('2026-11-18')).toBe(3);
    expect(diaSemana('2026-11-22')).toBe(0);
    expect(diaSemana('2026-11-25')).toBe(3);
    expect(diaSemana('2026-11-21')).toBe(6);
  });
  it('somarDias e diasEntre atravessam mês, ano e bissexto', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-12-24', -1)).toBe('2026-12-23');
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(somarDias('2026-11-25', 0)).toBe('2026-11-25');
    expect(diasEntre('2026-11-21', '2026-11-22')).toBe(1);
    expect(diasEntre('2026-11-25', '2026-11-18')).toBe(-7);
    expect(diasEntre('2026-12-30', '2027-01-03')).toBe(4);
  });
  it('formatos dd/mm', () => {
    expect(formatarDDMM('2026-12-06')).toBe('06/12');
    expect(formatarDDMMAAAA('2026-12-06')).toBe('06/12/2026');
  });
  it('nomes de dias e meses', () => {
    expect(nomeDia('2026-11-25')).toBe('Quarta-feira');
    expect(nomeDia('2026-11-21')).toBe('Sábado');
    expect(nomeDia('2026-11-22')).toBe('Domingo');
    expect(nomeDiaCurto('2026-11-25')).toBe('Qua');
    expect(nomeDiaCurto('2026-11-21')).toBe('Sáb');
    expect(nomeMes(11)).toBe('novembro');
    expect(nomeMes('2026-03-01')).toBe('março');
    expect(nomeMesCurto(11)).toBe('nov');
    expect(nomeMesCurto('2026-12-06')).toBe('dez');
    expect(() => nomeMes(13)).toThrow(RangeError);
  });
  it('rotuloRelativo', () => {
    const hoje = '2026-11-25';
    expect(rotuloRelativo('2026-11-25', hoje)).toBe('Hoje');
    expect(rotuloRelativo('2026-11-26', hoje)).toBe('Amanhã');
    expect(rotuloRelativo('2026-11-24', hoje)).toBe('Ontem');
    expect(rotuloRelativo('2026-11-29', hoje)).toBe('Em 4 dias');
    expect(rotuloRelativo('2026-11-22', hoje)).toBe('Há 3 dias');
  });
});

describe('horas como a igreja escreve', () => {
  it('horaParaMinutos', () => {
    expect(horaParaMinutos('19h30')).toBe(1170);
    expect(horaParaMinutos('10h')).toBe(600);
    expect(horaParaMinutos('7h')).toBe(420);
    expect(horaParaMinutos('19:30')).toBe(1170);
    expect(horaParaMinutos(' 10H ')).toBe(600);
    expect(horaParaMinutos('19h30min')).toBe(1170);
    for (const ruim of ['', '25h', '10h75', 'abc', '1930', null, undefined]) expect(horaParaMinutos(ruim)).toBeNaN();
  });
  it('minutosParaHora', () => {
    expect(minutosParaHora(1170)).toBe('19h30');
    expect(minutosParaHora(600)).toBe('10h');
    expect(minutosParaHora(540)).toBe('9h');
    expect(minutosParaHora(-60)).toBe('23h');
    expect(minutosParaHora(1500)).toBe('1h');
    expect(minutosParaHora(Number.NaN)).toBe('');
  });
});

describe('fuso da unidade', () => {
  it('fusoValido', () => {
    expect(fusoValido('America/Sao_Paulo')).toBe(true);
    expect(fusoValido('Lua/Base_Alfa')).toBe(false);
    expect(fusoValido('')).toBe(false);
    expect(fusoValido(42)).toBe(false);
  });
  it('deslocamentoFuso descobre o deslocamento com Intl (com horário de verão)', () => {
    expect(deslocamentoFuso(new Date('2026-11-25T12:00:00Z'), 'America/Sao_Paulo')).toBe(-180);
    expect(deslocamentoFuso(new Date('2018-11-25T12:00:00Z'), 'America/Sao_Paulo')).toBe(-120); // horário de verão de 2018
    expect(deslocamentoFuso(new Date('2026-07-05T12:00:00Z'), 'America/New_York')).toBe(-240);
    expect(deslocamentoFuso(new Date('2026-01-04T12:00:00Z'), 'America/New_York')).toBe(-300);
    expect(deslocamentoFuso(new Date('2026-11-25T12:00:00Z'), 'Asia/Kolkata')).toBe(330);
    expect(deslocamentoFuso(new Date('2026-11-25T12:00:00Z'), 'UTC')).toBe(0);
    expect(deslocamentoFuso(new Date('2026-11-25T12:00:00Z'))).toBe(-180);
  });
  it('hojeNoFuso usa o fuso, não o relógio do servidor', () => {
    const quaseMeiaNoite = new Date('2026-11-26T02:30:00Z'); // 23h30 de quarta em São Paulo
    expect(hojeNoFuso('America/Sao_Paulo', quaseMeiaNoite)).toBe('2026-11-25');
    expect(hojeNoFuso('UTC', quaseMeiaNoite)).toBe('2026-11-26');
    expect(hojeNoFuso('Asia/Tokyo', quaseMeiaNoite)).toBe('2026-11-26');
    expect(hojeNoFuso(undefined, quaseMeiaNoite)).toBe('2026-11-25');
  });
  it('hojeNoFuso aceita relógio injetado como função ou número e cai no padrão com fuso desconhecido', () => {
    const relogio = () => new Date('2026-11-25T15:00:00Z');
    expect(hojeNoFuso('America/Sao_Paulo', relogio)).toBe('2026-11-25');
    expect(hojeNoFuso('America/Sao_Paulo', Date.parse('2026-01-01T02:00:00Z'))).toBe('2025-12-31');
    expect(hojeNoFuso('Fuso/Inexistente', new Date('2026-11-26T02:30:00Z'))).toBe('2026-11-25');
    expect(dataValida(hojeNoFuso())).toBe(true);
    expect(() => hojeNoFuso('UTC', new Date('x'))).toThrow(RangeError);
  });
  it('instanteDoCulto converte data + hora do fuso para UTC', () => {
    expect(instanteDoCulto('2026-11-22', '10h', 'America/Sao_Paulo').toISOString()).toBe('2026-11-22T13:00:00.000Z');
    expect(instanteDoCulto('2026-11-25', '19h30', 'America/Sao_Paulo').toISOString()).toBe('2026-11-25T22:30:00.000Z');
    expect(instanteDoCulto('2026-11-22', '17h').toISOString()).toBe('2026-11-22T20:00:00.000Z');
    // horário de verão antigo de São Paulo (−2) e fusos com mudança de horário
    expect(instanteDoCulto('2018-11-25', '10h', 'America/Sao_Paulo').toISOString()).toBe('2018-11-25T12:00:00.000Z');
    expect(instanteDoCulto('2026-07-05', '10h', 'America/New_York').toISOString()).toBe('2026-07-05T14:00:00.000Z');
    expect(instanteDoCulto('2026-01-04', '10h', 'America/New_York').toISOString()).toBe('2026-01-04T15:00:00.000Z');
    expect(instanteDoCulto('2026-11-22', '10h', 'Asia/Kolkata').toISOString()).toBe('2026-11-22T04:30:00.000Z');
  });
  it('instanteDoCulto: hora vazia conta como 0h; data inválida lança erro; fuso desconhecido usa o padrão', () => {
    expect(instanteDoCulto('2026-12-24', '', 'America/Sao_Paulo').toISOString()).toBe('2026-12-24T03:00:00.000Z');
    expect(instanteDoCulto('2026-11-22', '10h', 'Nada/Disso').toISOString()).toBe('2026-11-22T13:00:00.000Z');
    expect(() => instanteDoCulto('2026-02-30', '10h')).toThrow(TypeError);
  });
  it('janelaCheckin abre 2h antes e fecha 3h depois do início', () => {
    const j = janelaCheckin('2026-11-29', '10h', 'America/Sao_Paulo');
    expect(CHECKIN_ABRE_ANTES_MINUTOS).toBe(120);
    expect(CHECKIN_FECHA_DEPOIS_MINUTOS).toBe(180);
    expect(j.inicio.toISOString()).toBe('2026-11-29T13:00:00.000Z');
    expect(j.abreEm.toISOString()).toBe('2026-11-29T11:00:00.000Z');
    expect(j.fechaEm.toISOString()).toBe('2026-11-29T16:00:00.000Z');
  });
});
