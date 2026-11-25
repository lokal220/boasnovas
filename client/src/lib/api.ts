/**
 * Cliente HTTP da API (contrato em shared/api.ts).
 * - Envia `X-BN: 1` em toda requisição que altera dados (o servidor recusa sem ele).
 * - Erros viram `ErroApi` com a mensagem pt-BR do servidor (campo `erro`) e o status HTTP.
 */
import type { ErroDTO } from '@shared/api';

export class ErroApi extends Error {
  constructor(message: string, readonly status: number, readonly detalhes?: unknown) {
    super(message);
    this.name = 'ErroApi';
  }
}

const MENSAGEM_PADRAO = 'Não deu certo. Tente de novo em instantes.';

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const cabecalhos: Record<string, string> = { Accept: 'application/json' };
  if (metodo !== 'GET') cabecalhos['X-BN'] = '1';
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  let resposta: Response;
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      credentials: 'same-origin',
    });
  } catch {
    throw new ErroApi('Sem conexão. Confira a internet e tente de novo.', 0);
  }
  if (resposta.status === 204) return undefined as T;
  const tipo = resposta.headers.get('content-type') ?? '';
  const dados: unknown = tipo.includes('application/json') ? await resposta.json().catch(() => null) : await resposta.text();
  if (!resposta.ok) {
    const erro = dados && typeof dados === 'object' && 'erro' in dados ? (dados as ErroDTO) : null;
    throw new ErroApi(erro?.erro || MENSAGEM_PADRAO, resposta.status, erro?.detalhes);
  }
  return dados as T;
}

export const api = {
  get: <T>(caminho: string) => requisitar<T>('GET', caminho),
  post: <T>(caminho: string, corpo?: unknown) => requisitar<T>('POST', caminho, corpo ?? {}),
  put: <T>(caminho: string, corpo?: unknown) => requisitar<T>('PUT', caminho, corpo ?? {}),
  patch: <T>(caminho: string, corpo?: unknown) => requisitar<T>('PATCH', caminho, corpo ?? {}),
  del: <T>(caminho: string) => requisitar<T>('DELETE', caminho),
};

/** Monta query string ignorando valores vazios. */
export function qs(parametros: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(parametros)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
