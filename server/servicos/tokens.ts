/**
 * Tokens dos links (grupo do ministério e link pessoal) e montagem das URLs públicas.
 * base = URL_PUBLICA (Secrets) ou a origem da requisição (protocolo + host, respeitando trust proxy).
 */
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { env } from '../env';

/** 18 bytes aleatórios em base64url (24 caracteres). */
export function gerarToken(): string {
  return randomBytes(18).toString('base64url');
}

/** Formato de token aceito nas rotas públicas (evita consultas com lixo). */
export function tokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(token);
}

export function urlBase(req: Request): string {
  if (env.urlPublica) return env.urlPublica;
  const host = req.host;
  if (!host) return `http://localhost:${env.porta}`;
  return `${req.protocol}://${host}`;
}

/** Base para mensagens fora de uma requisição (log de boot): URL_PUBLICA, domínio do Replit ou localhost. */
export function urlBaseDoAmbiente(): string {
  if (env.urlPublica) return env.urlPublica;
  const dominioReplit = (process.env.REPLIT_DEV_DOMAIN ?? process.env.REPLIT_DOMAINS?.split(',')[0] ?? '').trim();
  if (dominioReplit) return `https://${dominioReplit}`;
  return `http://localhost:${env.porta}`;
}

export const linkPublico = (base: string, tokenPublico: string): string => `${base}/e/${tokenPublico}`;
export const linkPessoal = (base: string, tokenAcesso: string): string => `${base}/v/${tokenAcesso}`;
