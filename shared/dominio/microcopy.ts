/**
 * Microcopy no tom da igreja (SPEC §6): caixa de frase, "você", frases curtas, no máximo um 💚 por mensagem
 * e nunca em erro. Funções puras que recebem o nome e a ficha da agenda ('Altar · BN Estoril · Dom | 10h').
 */
import { horaParaMinutos, minutosParaHora } from './datas';
import { diaDaFrase } from './formato';
import { primeiroNome, semMarcadores } from './texto';

/** Erro genérico (sem 💚, sem detalhes internos). */
export const MENSAGEM_ERRO = 'Não deu certo. Tente de novo em instantes.';
/** Resposta ao "não consigo dessa vez". */
export const MENSAGEM_NAO_CONSIGO = 'Tudo bem. Obrigado por avisar com antecedência; seu líder já foi avisado.';
/** Agradecimento depois do culto. */
export const MENSAGEM_POS_CULTO = 'Obrigado por servir hoje. Deus usa pessoas improváveis, inclusive você. 💚';

/** Antecedência padrão de chegada (1h antes do culto, como "10h → te esperamos às 9h"). */
export const ANTECEDENCIA_CHEGADA_MINUTOS = 60;

/** Horário de chegada: horaDeChegada('10h') → '9h'; horaDeChegada('19h30', 30) → '19h'; hora inválida → ''. */
export function horaDeChegada(hora: string, minutosAntes: number = ANTECEDENCIA_CHEGADA_MINUTOS): string {
  const m = horaParaMinutos(hora);
  return Number.isFinite(m) ? minutosParaHora(m - minutosAntes) : '';
}

/** 'às 9h', 'à 1h' (uma hora leva crase no singular). */
function asHoras(hora: string): string {
  return /^1h/.test(hora) ? `à ${hora}` : `às ${hora}`;
}

function oi(nome: string): string {
  const n = primeiroNome(nome);
  return n ? `Oi, ${n}!` : 'Oi!';
}

/** Convite: 'Oi, Ana! Você está na escala de domingo. Altar · BN Estoril · Dom | 10h. Pode confirmar?' */
export function mensagemConvite(dados: { nome: string; data: string; ficha: string }): string {
  return `${oi(dados.nome)} Você está na escala de ${diaDaFrase(dados.data)}. ${semMarcadores(dados.ficha)}. Pode confirmar?`;
}

/**
 * Confirmação: 'Confirmado! Te esperamos às 9h. 💚' (chegada informada, ou 1h antes da hora do culto);
 * sem horário: 'Confirmado! Te esperamos. 💚'.
 */
export function mensagemConfirmado(dados: { hora?: string; chegada?: string; antecedenciaMinutos?: number } = {}): string {
  const chegada = semMarcadores(dados.chegada) || (dados.hora ? horaDeChegada(dados.hora, dados.antecedenciaMinutos) : '');
  return chegada ? `Confirmado! Te esperamos ${asHoras(chegada)}. 💚` : 'Confirmado! Te esperamos. 💚';
}

/** Lembrete da véspera: 'Amanhã é dia de servir. Altar · BN Estoril · Dom | 17h.' */
export function mensagemVespera(dados: { ficha: string }): string {
  return `Amanhã é dia de servir. ${semMarcadores(dados.ficha)}.`;
}

/** Pedido de troca: 'O João pediu uma troca com você: Altar · BN Estoril · Quarta | 19h30. Aceita?' (artigo '' omite). */
export function mensagemPedidoTroca(dados: { nome: string; ficha: string; artigo?: 'O' | 'A' | '' }): string {
  const artigo = dados.artigo ?? 'O';
  const nome = primeiroNome(dados.nome) || 'Alguém';
  return `${artigo ? `${artigo} ` : ''}${nome} pediu uma troca com você: ${semMarcadores(dados.ficha)}. Aceita?`;
}

/** Resposta ao "não consigo dessa vez" (sem culpa). */
export function mensagemNaoConsigo(): string {
  return MENSAGEM_NAO_CONSIGO;
}

/** Agradecimento pós-culto. */
export function mensagemPosCulto(): string {
  return MENSAGEM_POS_CULTO;
}

/** Erro genérico para mostrar ao usuário. */
export function mensagemErro(): string {
  return MENSAGEM_ERRO;
}

/** Saudação do topo da "minha escala", em minúsculas como os títulos da igreja: 'olá, marina'. */
export function saudacao(nome: string): string {
  const n = primeiroNome(nome).toLocaleLowerCase('pt-BR');
  return n ? `olá, ${n}` : 'olá';
}

/** Toast de presença confirmada: 'Presença confirmada para domingo, 10h. Obrigado por servir 💚' */
export function mensagemPresencaConfirmada(dados: { data: string; hora?: string }): string {
  const hora = semMarcadores(dados.hora);
  return `Presença confirmada para ${diaDaFrase(dados.data)}${hora ? `, ${hora}` : ''}. Obrigado por servir 💚`;
}

/** Inscrição pelo link do grupo: 'Pronto! Seu nome está na escala: Altar · BN Estoril · Dom | 10h. 💚' */
export function mensagemInscricao(dados: { ficha: string }): string {
  return `Pronto! Seu nome está na escala: ${semMarcadores(dados.ficha)}. 💚`;
}

/** Desmarcar a disponibilidade: 'Tudo bem, seu nome saiu desse culto.' */
export function mensagemDesmarcado(): string {
  return 'Tudo bem, seu nome saiu desse culto.';
}

/** Troca pedida: 'Pedido de troca enviado. Avisamos quando alguém aceitar.' */
export function mensagemTrocaPedida(): string {
  return 'Pedido de troca enviado. Avisamos quando alguém aceitar.';
}

/** Troca aceita por quem substitui: 'Troca feita! Agora você está na escala: Altar · BN Estoril · Dom | 10h. 💚' */
export function mensagemTrocaAceita(dados: { ficha: string }): string {
  return `Troca feita! Agora você está na escala: ${semMarcadores(dados.ficha)}. 💚`;
}

/** Check-in feito: 'Check-in feito. Bom culto! 💚' */
export function mensagemCheckin(): string {
  return 'Check-in feito. Bom culto! 💚';
}
