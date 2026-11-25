/**
 * Utilidades HTTP do servidor: erro com status, validação zod com mensagens em pt-BR e relógio do contexto.
 */
import type { Request } from 'express';
import type { z } from 'zod';
import type { ContextoApp } from './app';

/** Erro de regra de negócio/requisição: vira `{ erro }` com o status indicado (ver app.ts). */
export class ErroHttp extends Error {
  constructor(readonly status: number, mensagem: string, readonly detalhes?: unknown) {
    super(mensagem);
    this.name = 'ErroHttp';
  }
}

export const naoEncontrado = (mensagem: string) => new ErroHttp(404, mensagem);
export const proibido = (mensagem = 'Você não tem acesso a isso.') => new ErroHttp(403, mensagem);
export const conflito = (mensagem: string) => new ErroHttp(409, mensagem);
export const invalido = (mensagem: string, detalhes?: unknown) => new ErroHttp(400, mensagem, detalhes);

/** Instante atual pelo relógio do contexto (injetável nos testes). */
export function agoraDe(ctx: ContextoApp): Date {
  return ctx.agora?.() ?? new Date();
}

type IssueBruta = { code?: string; origin?: string; input?: unknown };

/** Mensagens padrão (as mensagens escritas em shared/validacao.ts têm prioridade sobre estas). */
function mensagemPadrao(issue: IssueBruta): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === null
        ? 'Preencha os campos obrigatórios.'
        : 'Algum campo veio num formato inesperado.';
    case 'too_small':
      if (issue.origin === 'string') return 'Algum texto ficou curto demais.';
      if (issue.origin === 'array') return 'Escolha pelo menos um item.';
      return 'Algum número ficou abaixo do mínimo.';
    case 'too_big':
      if (issue.origin === 'string') return 'Algum texto ficou longo demais.';
      if (issue.origin === 'array') return 'Itens demais de uma vez.';
      return 'Algum número passou do máximo.';
    case 'invalid_value':
      return 'Escolha uma das opções disponíveis.';
    default:
      return 'Confira os dados e tente de novo.';
  }
}

/** Valida `dados` com o esquema zod; em caso de erro lança ErroHttp 400 com a primeira mensagem e os detalhes. */
export function validar<S extends z.ZodType>(esquema: S, dados: unknown): z.output<S> {
  const resultado = esquema.safeParse(dados ?? {}, { error: (issue) => mensagemPadrao(issue as IssueBruta) });
  if (resultado.success) return resultado.data;
  const detalhes = resultado.error.issues.map((i) => ({ campo: i.path.map(String).join('.'), mensagem: i.message }));
  throw invalido(detalhes[0]?.mensagem ?? 'Confira os dados e tente de novo.', detalhes);
}

/** Lê um parâmetro de query como texto simples (ignora arrays e vazios). */
export function textoQuery(req: Request, nome: string): string | undefined {
  const valor = req.query[nome];
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim();
  return limpo ? limpo : undefined;
}

/** Lê um parâmetro de rota (Express 5 tipa como string). */
export function param(req: Request, nome: string): string {
  const valor = (req.params as Record<string, string | undefined>)[nome];
  return typeof valor === 'string' ? valor : '';
}
