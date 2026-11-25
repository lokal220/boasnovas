/**
 * Apoio dos testes do domínio: dados reais de seed/ e montagem dos cultos do gabarito.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CultoComEscalaDTO, EscaladoDTO, StatusEscala, Turno } from '@shared/api';
import { calcularCobertura } from '@shared/dominio';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function ler(relativo: string): string {
  return readFileSync(path.join(RAIZ, relativo), 'utf8');
}

export interface MembroSeed { id: string; nome: string; apelidos: string[]; escalas: string[]; lider: boolean; ativo: boolean }
export interface CultoEsperado { id: string; data: string; turno: Turno; evento: string; lider: string; servos: string[] }
export interface Esperado { titulo: string; aviso: string; cultos: CultoEsperado[] }

export const membros: MembroSeed[] = JSON.parse(ler('seed/membros.json'));
export const esperado: Esperado = JSON.parse(ler('seed/esperado.json'));
export const listaWhatsApp = ler('seed/lista-whatsapp-nov-dez-2026.txt');
/** Texto completo esperado da exportação dos 25 cultos (com passados), sem a quebra de linha final do arquivo. */
export const fixtureEscala = ler('tests/dominio/fixtures/escala-nov-dez-2026.txt').replace(/\n$/, '');
export const LINK_GRUPO = 'https://example.com/escala-do-altar';

export const nomePorId: Record<string, string> = Object.fromEntries(membros.map((m) => [m.id, m.nome]));

const HORAS: Record<Turno, string> = { manha: '10h', tarde: '17h', noite: '19h30', unico: '19h30' };

/** Escalado no formato do contrato. */
export function escalado(membroId: string, papel: 'servo' | 'lider' = 'servo', status: StatusEscala = 'confirmado'): EscaladoDTO {
  return {
    escalaId: `e-${membroId}`, membroId, nome: nomePorId[membroId] ?? membroId, papel, funcao: '',
    status, origem: 'importacao', checkinEm: null,
  };
}

/** Os 25 cultos do gabarito como CultoComEscalaDTO (líder primeiro, servos na ordem do gabarito). */
export function cultosDoGabarito(): CultoComEscalaDTO[] {
  return esperado.cultos.map((c) => {
    const escalados = [
      ...(c.lider ? [escalado(c.lider, 'lider')] : []),
      ...c.servos.map((s) => escalado(s)),
    ];
    return {
      id: `bn-estoril:${c.data}:${c.turno}`, unidadeId: 'bn-estoril', data: c.data, hora: HORAS[c.turno], turno: c.turno,
      titulo: c.evento, extra: false, nota: '', vespera: null,
      ministerioId: 'altar', vagas: 3, escalados, cobertura: calcularCobertura(escalados, 3),
    };
  });
}

/** Resumo comparável de um culto lido pelo parser (ids no lugar das referências). */
export function resumo(c: { data: string; turno: Turno; titulo: string; lider: { membroId: string } | null; servos: { membroId: string }[] }) {
  return { data: c.data, turno: c.turno, titulo: c.titulo, lider: c.lider ? c.lider.membroId : '', servos: c.servos.map((s) => s.membroId) };
}

/** O gabarito no mesmo formato de `resumo`. */
export function resumoEsperado() {
  return esperado.cultos.map((c) => ({ data: c.data, turno: c.turno, titulo: c.evento, lider: c.lider, servos: c.servos }));
}

/** Membros no formato que o parser recebe. */
export const membrosParser = membros.map((m) => ({ id: m.id, nome: m.nome, apelidos: m.apelidos }));
