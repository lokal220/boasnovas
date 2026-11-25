/**
 * Senhas dos líderes: scrypt (sal de 16 bytes, N=16384, r=8, p=1, 64 bytes) no formato
 * `scrypt$N$r$p$sal$hash` (sal e hash em base64), comparadas com timingSafeEqual.
 */
import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const TAMANHO_HASH = 64;
const TAMANHO_SAL = 16;
const MEMORIA_MAXIMA = 256 * 1024 * 1024;

function derivar(senha: string, sal: Buffer, tamanho: number, opcoes: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha.normalize('NFKC'), sal, tamanho, { ...opcoes, maxmem: MEMORIA_MAXIMA }, (erro, chave) => {
      if (erro) reject(erro);
      else resolve(chave);
    });
  });
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL);
  const hash = await derivar(senha, sal, TAMANHO_HASH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

/** Hash de uma senha qualquer: usado para gastar o mesmo tempo quando o login não existe. */
let hashFicticio: Promise<string> | null = null;
export function hashParaComparacaoVazia(): Promise<string> {
  hashFicticio ??= gerarHashSenha(randomBytes(16).toString('hex'));
  return hashFicticio;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, nTexto, rTexto, pTexto, salB64, hashB64] = partes as [string, string, string, string, string, string];
  const n = Number(nTexto);
  const r = Number(rTexto);
  const p = Number(pTexto);
  const potenciaDeDois = Number.isInteger(n) && n > 1 && (n & (n - 1)) === 0;
  if (!potenciaDeDois || n > 1 << 20 || !Number.isInteger(r) || r < 1 || r > 32 || !Number.isInteger(p) || p < 1 || p > 16) return false;
  const esperado = Buffer.from(hashB64, 'base64');
  const sal = Buffer.from(salB64, 'base64');
  if (esperado.length < 16 || sal.length < 8) return false;
  const calculado = await derivar(senha, sal, esperado.length, { N: n, r, p });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/** Senha aleatória legível (sem caracteres ambíguos), ex.: 'k7mq-x4rt-9bwz' (~60 bits). */
export function gerarSenhaAleatoria(): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
  const grupos: string[] = [];
  for (let g = 0; g < 3; g++) {
    let grupo = '';
    for (let i = 0; i < 4; i++) grupo += alfabeto[randomInt(alfabeto.length)];
    grupos.push(grupo);
  }
  return grupos.join('-');
}
