import type { Banco } from './index';

/** Prepara o banco no boot: garante o primeiro administrador e semeia os dados reais quando vazio. */
export async function prepararDados(_db: Banco, _opcoes: { semear: boolean }): Promise<void> {
  // implementado em seguida (admin inicial + seed da escala do altar)
}
