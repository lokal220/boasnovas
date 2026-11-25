import { describe, expect, it } from 'vitest';
import {
  apenasDigitos, compararNomes, iniciais, levenshtein, maiusculaInicial, normalizar, primeiroNome, semMarcadores, slug, tituloNome,
} from '@shared/dominio';

describe('normalizar', () => {
  it('tira acento, caixa e espaços extras', () => {
    expect(normalizar('  Hércules  JÚNIOR ')).toBe('hercules junior');
    expect(normalizar('Rômulo\u{00A0}\u{00A0}líder')).toBe('romulo lider');
    expect(normalizar('MANHÃ\tTARDE\nNOITE')).toBe('manha tarde noite');
  });
  it('remove caracteres invisíveis colados pelo WhatsApp', () => {
    expect(normalizar('Her\u{200B}ick\u{FEFF}')).toBe('herick');
    expect(normalizar('Alê\u{00AD}')).toBe('ale');
  });
  it('aceita nulo e indefinido', () => {
    expect(normalizar(null)).toBe('');
    expect(normalizar(undefined)).toBe('');
  });
});

describe('slug', () => {
  it('gera ids legíveis e estáveis', () => {
    expect(slug('Thiago Daniel')).toBe('thiago-daniel');
    expect(slug('Joe (Jônatas)')).toBe('joe-jonatas');
    expect(slug('Wallace Júnior')).toBe('wallace-junior');
    expect(slug('Alê')).toBe('ale');
    expect(slug('  Ação & Reação!  ')).toBe('acao-reacao');
    expect(slug('')).toBe('');
  });
});

describe('levenshtein', () => {
  it('conta inserções, remoções e trocas', () => {
    expect(levenshtein('danjel', 'daniel')).toBe(1);
    expect(levenshtein('herick', 'herbert')).toBe(4);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('igual', 'igual')).toBe(0);
    expect(levenshtein('hercule', 'hercules')).toBe(1);
  });
  it('conta emoji como um caractere', () => {
    expect(levenshtein('a🙏', 'a')).toBe(1);
  });
});

describe('tituloNome', () => {
  it('põe maiúscula em cada palavra e mantém partículas minúsculas', () => {
    expect(tituloNome('wanderlei')).toBe('Wanderlei');
    expect(tituloNome('joão DA silva')).toBe('João da Silva');
    expect(tituloNome('  maria   dos  santos ')).toBe('Maria dos Santos');
    expect(tituloNome('ana-clara')).toBe('Ana-Clara');
    expect(tituloNome('joe (jônatas)')).toBe('Joe (Jônatas)');
    expect(tituloNome("d'ávila")).toBe("D'Ávila");
    expect(tituloNome('de souza')).toBe('De Souza');
    expect(tituloNome(null)).toBe('');
  });
});

describe('iniciais', () => {
  it('usa primeira e última palavra; nome de uma palavra usa duas letras', () => {
    expect(iniciais('Thiago Daniel')).toBe('TD');
    expect(iniciais('Wallace Júnior')).toBe('WJ');
    expect(iniciais('joão da silva')).toBe('JS');
    expect(iniciais('Herick')).toBe('HE');
    expect(iniciais('Alê')).toBe('AL');
    expect(iniciais('Yan')).toBe('YA');
    expect(iniciais('Joe (Jônatas)')).toBe('JO');
    expect(iniciais('Érico Ávila')).toBe('ÉÁ');
    expect(iniciais('')).toBe('');
    expect(iniciais('  ')).toBe('');
  });
});

describe('primeiroNome', () => {
  it('devolve a primeira palavra como está escrita', () => {
    expect(primeiroNome('Thiago Daniel')).toBe('Thiago');
    expect(primeiroNome('Joe (Jônatas)')).toBe('Joe');
    expect(primeiroNome('  Alê  ')).toBe('Alê');
    expect(primeiroNome('*Herick*')).toBe('Herick');
    expect(primeiroNome('')).toBe('');
    expect(primeiroNome(undefined)).toBe('');
  });
});

describe('utilitários de texto', () => {
  it('apenasDigitos', () => {
    expect(apenasDigitos('(31) 99999-8888')).toBe('31999998888');
    expect(apenasDigitos(5531)).toBe('5531');
    expect(apenasDigitos(null)).toBe('');
  });
  it('compararNomes ordena em pt-BR sem diferenciar acento e caixa', () => {
    expect(['Érico', 'bruno', 'Alê', 'Ana'].sort(compararNomes)).toEqual(['Alê', 'Ana', 'bruno', 'Érico']);
    expect(compararNomes('Hércules', 'hercules')).toBe(0);
  });
  it('semMarcadores tira * _ ~ ` e junta espaços', () => {
    expect(semMarcadores('*Altar*  _BN_ ~Estoril~ `x`')).toBe('Altar BN Estoril x');
    expect(semMarcadores(undefined)).toBe('');
  });
  it('maiusculaInicial', () => {
    expect(maiusculaInicial('novembro')).toBe('Novembro');
    expect(maiusculaInicial('érico')).toBe('Érico');
    expect(maiusculaInicial('')).toBe('');
  });
});
