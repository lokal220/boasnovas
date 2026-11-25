# SPEC — Escalas · Boas Novas Church

Contrato do projeto para todo mundo que mexe no código (pessoas e agentes). Leia inteiro antes de começar.

## 1. Produto
Sistema de escalas de voluntários da **Boas Novas Church** (BN Estoril, Belo Horizonte — @boasnovaschurch),
que vai rodar no **Replit** (repositório GitHub `lokal220/boasnovas`). Primeira escala: **homens que servem no
altar**; o sistema já nasce para vários ministérios (louvor, recepção, mídia, kids…).

Hoje a escala é uma lista no WhatsApp: "Coloque seu nome no dia que estiver disponível para servir". Cada um copia a
mensagem, põe o nome e cola de volta. Regra da igreja: **"Quando houver cultos/eventos fora dos dias fixos de culto,
a escala será feita um dia antes."**

Dias fixos (bio do Instagram): **Dom 10h, 17h e 19h30 | Terça 14h | Quarta 19h30**. O altar serve **Quarta 19h30** e
**Domingo 10h (manhã), 17h (tarde), 19h30 (noite)**. A terça 14h ("tarde da benção") existe na agenda da unidade,
mas não entra no altar.

### Pessoas
- **Voluntário** (sem senha): entra pelo **link do grupo** do ministério (escolhe o próprio nome, como na lista do
  WhatsApp) ou pelo **link pessoal** (minha escala). Marca disponibilidade, confirma, diz "não consigo dessa vez",
  pede e aceita troca, faz check-in no dia, adiciona as escalas na agenda do celular.
- **Líder** (com login e senha): monta e ajusta a escala dos ministérios dele, define o líder de cada culto, gera os
  cultos do mês, cria eventos extras, importa a lista do WhatsApp, exporta o texto para o grupo, lembra pendentes,
  resolve trocas, gerencia a equipe e os links.
- **Admin**: tudo do líder em todos os ministérios + unidades/agenda fixa + contas de líderes.

### Escopo desta versão
P0 (obrigatório): dados e seed reais; link do grupo com "quero servir"; minha escala (confirmar / não consigo /
pedir troca); login do líder; painel do ministério; editor de escala do culto; cultos (gerar mês, evento extra);
equipe e links pessoais; importar e exportar WhatsApp; ajustes; Replit pronto; testes.
P1 (também nesta versão): trocas completas (aceitar), check-in no dia + modo telão do líder, agenda .ics, lembretes
de pendentes via WhatsApp, calendário mensal, histórico de alterações, app instalável (PWA).
Fora: notificações automáticas (push/WhatsApp API), pagamentos, integração com o App BNC (InChurch).

## 2. Arquitetura (pronta — não reestruture)
- Node ≥ 20.19, TypeScript estrito, um único `package.json`. `npm run dev` sobe Express + Vite na porta 5000.
- `client/` React 19 + Vite + wouter (rotas) + TanStack Query (dados) + lucide-react (ícones de linha, `strokeWidth={1.5}`).
  CSS próprio com tokens (sem Tailwind). Alias `@/` → `client/src`, `@shared/` → `shared`.
- `server/` Express 5: `app.ts` (monta o app; usado nos testes), `index.ts` (boot), `vite.ts` (cliente),
  `db/` (conexão + migrações + inicialização), `rotas/` (HTTP), `servicos/` (regras com banco), `auth/` (senha, sessão).
- `shared/` código usado pelos dois lados: `schema.ts` (tabelas Drizzle), `api.ts` (**contrato HTTP — autoritativo**),
  `validacao.ts` (zod das requisições), `dominio/` (regras puras: datas, texto, cobertura, agenda, WhatsApp, ics).
- Banco: PostgreSQL via `DATABASE_URL` (Replit); sem ele, **PGlite** (Postgres embutido) em `.data/pglite`;
  nos testes, PGlite em memória (`abrirBanco({ memoria: true })`). Migrações em `server/db/migracoes`, aplicadas no
  boot. Mudou `shared/schema.ts`? `npm run db:generate` e commite a migração.
- Testes: `npm test` (vitest; `tests/**/*.test.ts`), `npm run check` (tsc), `npm run test:e2e` (Playwright via script).
  Playwright em scripts `.mjs`: `import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');`
  e `chromium.launch()` sem opções (navegador pré-instalado; não instale outro).
- Build: `npm run build` → `dist/public` (cliente) + `dist/index.js` (servidor). `npm start` em produção.

## 3. Regras de domínio
- **Turnos**: `manha | tarde | noite | unico` (`unico` = culto único do dia: quarta, eventos extras). Nomes:
  Manhã, Tarde, Noite, Culto. `turnoPorHora`: < 12h manhã, < 18h tarde, senão noite.
- **Cultos** têm data, hora ('10h', '19h30' — como a igreja escreve), turno, título de evento ('Santa Ceia', 'Natal',
  'Réveillon', 'Batismo', 'Vigília' ou livre) e `extra` (fora dos dias fixos → mostrar "escala feita na véspera, dd/mm").
  Id: `${unidadeId}:${data}:${turno}` (com sufixo `-2`, `-3` se repetir).
- **Escala** = pessoa + culto + ministério, com `papel` (`servo` | `lider` — o líder daquele culto, no máximo 1 por
  culto/ministério), `funcao` livre e `status`:
  `confirmado` · `pendente` (aguardando a pessoa confirmar) · `nao_pode` ("não consigo dessa vez") · `troca` (pediu troca).
  Voluntário que se inscreve → `confirmado` (origem `voluntario`). Líder que escala → `confirmado` por padrão ou
  `pendente` quando pedir confirmação. Importação do WhatsApp → `confirmado` (origem `importacao`).
- **Cobertura** de um culto/ministério: `pessoas` = confirmado + pendente + troca (nao_pode não conta);
  `vagas` = override do culto ou `vagasPadrao` do ministério (padrão 3); `faltam` = max(0, vagas − pessoas);
  status `completo` (pessoas ≥ vagas), `parcial` (0 < pessoas < vagas), `vazio` (0). Mostrar "3 de 4 confirmados" usando
  `confirmados`, e "1 aguardando" quando houver pendentes.
- **Disponibilidade pelo link do grupo** (ministério `aberto`): marcar = criar escala `confirmado`/`voluntario`;
  desmarcar = apagar se a escala foi criada pelo voluntário e não tem check-in; se foi o líder que escalou, vira
  `nao_pode`. Ministério `restrito`: só pelo link pessoal. Não permitir mexer em culto que já passou.
- **Troca**: a pessoa pede → escala vira `troca` + registro `trocas` `aberta`. Outra pessoa do ministério aceita →
  nova escala dela `confirmado`/origem `troca`, escala original vira `nao_pode`, troca `aceita` com `substitutoId`.
  O solicitante pode cancelar (escala volta a `confirmado`). O líder pode resolver (aceitar com substituto escolhido
  ou cancelar).
- **Check-in**: abre 2h antes do início do culto e fecha 3h depois (fuso da unidade). Uma vez só.
- **Gerar cultos do mês**: para cada data do mês e cada horário ativo da agenda fixa da unidade, cria o culto se não
  existir. Não cria escalas.
- **Agenda .ics**: próximas escalas do membro (exceto `nao_pode`), duração padrão 2h, local = unidade.
- **Tokens**: `crypto.randomBytes(18).toString('base64url')` (link do grupo e link pessoal). Regeneráveis pelo líder.
- **Dados iniciais** (banco vazio e `SEMEAR_DADOS` ≠ false): unidade `bn-estoril` (BN Estoril, Av. Barão Homem de
  Melo, 2588, Estoril · BH) com agenda fixa (Dom 10h manhã, Dom 17h tarde, Dom 19h30 noite, Ter 14h tarde
  "tarde da benção", Qua 19h30 unico); ministério `altar` (Altar · "Homens que servem no altar" · vagas 3 · aberto ·
  horários = Qua 19h30 + os três de domingo · aviso = regra da véspera); os 20 membros de `seed/membros.json`
  (Rômulo e Guilherme com papel `lider` no ministério); os 25 cultos de 18/11 a 30/12/2026 com as escalas de
  `seed/esperado.json` (origem `importacao`, status `confirmado`, líder do culto com papel `lider`).
  Primeiro admin: `ADMIN_LOGIN`/`ADMIN_SENHA` dos Secrets; sem senha definida, gerar uma aleatória, gravar com
  `deveTrocarSenha: true` e mostrar **uma vez** no console junto com os links do grupo do altar.
- **"Hoje"** é sempre a data no fuso da unidade (America/Sao_Paulo), nunca a do servidor.

### WhatsApp
`shared/dominio/whatsapp/parser.ts` lê a lista do WhatsApp (gabarito: `seed/lista-whatsapp-nov-dez-2026.txt` →
exatamente `seed/esperado.json`). Regras completas (já validadas num protótipo anterior) em
`/home/user/escala-altar/SPEC.md` §5.3 — porte todas: normalização (CRLF, NBSP, `* _ ~`, emojis), cabeçalhos de data
com ou sem ano e evento entre parênteses, prefixos de turno (`Manhã:`, `Tarde.`, `Noite -`, linha só com o prefixo),
`Quarta:` ignorado, continuação de linha num domingo, líder `(Rômulo líder)`, separadores (`/ , ; | ' l ' ' e '`),
casamento guloso do maior nome conhecido ("Thiago Daniel" vence "Daniel"; "wanderlei naftali" → Wanderlei + Naftali),
aproximação Levenshtein 1 só para palavras ≥ 5 letras e candidato único ("Danjel" → Daniel, com aviso), nomes novos,
mensagens de disponibilidade. `wanderlei naftali` = duas pessoas (suposição registrada).

Formato do texto para o grupo (`textoEscala`) — o mesmo da lista atual, limpo:
```
_ESCALA DE SERVIÇO — NOVEMBRO/DEZEMBRO 2026_
*Altar · Boas Novas Church*

*22/11/2026 — Domingo*
Manhã: Alê / Herbert / Wallace Júnior
Tarde: Hércules / Daniel / Wesley / Bruno / Wanderlei / Naftali
Noite: Hércules / Gelton / Yan

*25/11/2026 — Quarta-feira*
Thiago Daniel / Herick / Alê / Matheus Augusto / Herbert

*29/11/2026 — Domingo*
Manhã: Guilherme / Alê / Gabriel (Rômulo líder)
…
*06/12/2026 — Domingo (Santa Ceia)*
…
*27/12/2026 — Domingo*
Manhã: (vago)
…

*Atenção 🚨: Quando houver cultos/eventos fora dos dias fixos de culto, a escala será feita um dia antes.*
Veja a escala e coloque seu nome: <link do grupo>
```
Turno `unico`: só os nomes. Evento extra: `*24/12/2026 — Quinta-feira (Vigília)*`. Líder: ` (Nome líder)` no fim
da linha; só líder: `(Rômulo líder)`. Vazio: `(vago)`. Só `confirmado`/`pendente`/`troca` entram (não `nao_pode`).
O fixture `/home/user/escala-altar/tests/fixtures/escala-nov-dez-2026.txt` tem o texto completo esperado dos 25 cultos.

## 4. Contratos de código
- **HTTP**: `shared/api.ts` (lista de endpoints no topo + tipos). Requisições validadas com `shared/validacao.ts`.
  Respostas de erro `{ erro }` em pt-BR. `X-BN: 1` obrigatório em toda requisição que altera dados.
- **Domínio** (`shared/dominio/`, funções puras, sem I/O):
  - `texto.ts`: `normalizar`, `slug`, `levenshtein`, `tituloNome`, `iniciais`, `primeiroNome`.
  - `datas.ts`: `FUSO_PADRAO`, `hojeNoFuso(fuso?, agora?)`, `dataValida`, `partesData`, `diaSemana`, `somarDias`,
    `diasEntre`, `formatarDDMM`, `formatarDDMMAAAA`, `nomeDia` ('Quarta-feira'), `nomeDiaCurto` ('Qua'), `nomeMes`
    ('novembro'), `nomeMesCurto` ('nov'), `rotuloRelativo` ('Hoje'/'Amanhã'/'Ontem'/'Em 4 dias'/'Há 3 dias'),
    `horaParaMinutos('19h30') → 1170`, `instanteDoCulto(data, hora, fuso) → Date` (UTC correto para o fuso).
  - `turnos.ts`: `TURNOS`, `turnoPorHora`, `compararCultos`.
  - `cobertura.ts`: `calcularCobertura(escalados, vagas) → CoberturaDTO`.
  - `agenda.ts`: `datasDoMes(ano, mes, agenda)`, `vespera(data)`, `ehDiaFixo(data, agenda)`, `idCulto(unidadeId, data, turno)`.
  - `formato.ts`: `fichaAgenda({ funcao?, unidade, data, hora })` → `'Altar · BN Estoril · Dom | 10h'`;
    `rotuloStatus(status)` → `{ rotulo, tom }` com rótulos `confirmado`, `aguardando você`, `não pode`, `troca pedida`
    e tons `ok | wait | no | swap`; `rotuloCobertura(cobertura)` → `'3 de 4 confirmados'`.
  - `whatsapp/parser.ts`: `analisarTexto(texto, { membros: {id, nome, apelidos}[], anoPadrao }) → ResultadoParserDTO`.
  - `whatsapp/exportar.ts`: `textoEscala`, `periodoDosCultos`, `textoDisponibilidade`, `textoLinkPessoal`,
    `textoLinkGrupo`, `textoLembrete`, `linkWhatsApp(texto, numero?)` (10–11 dígitos ganham DDI 55).
  - `ics.ts`: `gerarIcs(eventos, nomeCalendario)` (RFC 5545: CRLF, dobra de linha em 75 octetos, escapes, UTC).
  - `microcopy.ts`: textos do tom da igreja (seção 6).

## 5. Segurança e privacidade
- Senhas com `crypto.scrypt` (sal 16 bytes, N=16384, r=8, p=1, 64 bytes) no formato `scrypt$N$r$p$sal$hash`;
  comparação com `timingSafeEqual`. Sessão: cookie `bn_sessao` (httpOnly, SameSite=Lax, Secure em produção,
  30 dias); no banco só o SHA-256 do token. Sair apaga a sessão.
- Rate limit (express-rate-limit): login 10/15min por IP; rotas públicas e de membro que alteram dados 60/10min por IP.
- Autorização em toda rota de líder (líder só nos `ministerios` dele; admin em tudo). Rotas `/api/eu/:token` só
  enxergam os dados daquele membro. Rotas públicas só expõem nomes (nunca telefone, token ou dados de outros
  ministérios).
- Registrar em `registros` toda alteração (ator, ação, alvo, dados), inclusive as anônimas (hash do IP).
- Nada de segredos no código ou no repositório. Mensagens de erro sem detalhes internos.

## 6. Design — referência visual oficial
Fonte da verdade: **`docs/marca/referencia-visual-boas-novas.html`** (medida no Instagram da igreja em 23/11/2026).
Leia a página inteira (CSS e seções "marca", "cores", "tipografia", "composição", "sistema de escala", "tokens").
Siga também a skill `docs/skills/frontend-design.SKILL.md` (fluxo: entender → direção → interface real → código de
produção → refino → autorrevisão).
- **Tokens**: os da seção "tokens para desenvolvimento" + os do `:root` da referência (claro e escuro):
  verde `#2B503F` (ação/selo; hover `#1E3A2D`), sálvia display `#778867` (títulos ≥ 24px), sálvia texto `#576947`,
  menta `#D6E7D8` (hoje, meu turno), creme `#EAE7DC` (card de destaque), fundo `#F4F4EF`, superfície `#FFFFFF`,
  grafite `#161B16`, linhas `#D3D8CE`/`#868D82`; status confirmado/pendente/não pode/troca com cor de texto e fundo
  próprios (claro e escuro). Proporção: claros 62%, verde 20%, grafite 10%, menta 6%; vermelho só para erro.
- **Tipografia**: Inter Tight (display 300 em minúsculas com tracking negativo; h1 400; h2 500; h3 600; horário
  400 tabular), Inter (corpo 16/24, pequeno 14, legenda 12), Archivo a 112,5% de largura 600 em caixa alta +0,14em
  (rótulos/overline). Instrument Serif itálico só como acento editorial raro. Nunca a condensada vermelha.
- **Princípios**: pessoas primeiro (nome e iniciais em todo card; linguagem sem culpa: "não consigo dessa vez", nunca
  "ausente" em vermelho); título leve, dado preciso (títulos de tela em minúsculas; agenda sempre
  `Função · BN Unidade · Dia | hora`); verde é a casa; linha fina em vez de sombra (sombra só no que flutua);
  **status com três sinais** (cor + ícone + rótulo); servir é bastidor (check-in e telão em modo escuro com números
  enormes).
- **Componentes da referência** (traduzir para React): overline, título display, `ecard` (card de escala com
  overline de data, chip de status, hora grande, local, função, avatares, rodapé), chips `ok/wait/no/swap` com ícone,
  botões `primary/secondary/ghost/sm` em pílula, lista `li` com bloco de data, contagem regressiva escura, calendário
  mensal (dias de servir em verde, troca em azul, ponto sálvia para culto na agenda), estado vazio com o símbolo,
  toast, caixa de informação com contorno sálvia, moldura de anéis concêntricos (só em splash/login/início, nunca
  atrás de dados), wordmark vertical `boasnovas°` (só decorativo, fora de telas de dados).
- **Símbolo burst**: `docs/marca/simbolo-burst.svg` (vetorizado do arquivo oficial do site, `stroke="currentColor"`).
  Abaixo de 40px, engrosse o traço (16–20 no viewBox de 281). Usos: carregando (setas se desenham até o centro ~1,2s;
  estático com movimento reduzido), check-in feito (as setas se encontram), estado vazio (80–96px, sálvia a 40%),
  marca-d'água ≤ 6% só em splash.
- **Ícones**: lucide-react com `strokeWidth={1.5}`, sem preenchimento.
- **Espaçamento** base 4 (4 8 12 16 24 32 48 64); raios 8 / 16 / 24 / pílula; bordas 1px (divisória) e 1,5px (contorno).
- **Tema escuro** completo (tokens da referência) por `prefers-color-scheme` + alternância manual (`data-theme`).
- **Microcopy** (caixa de frase, "você", no máximo um 💚 por mensagem e nunca em erro):
  convite "Oi, Ana! Você está na escala de domingo. Altar · BN Estoril · Dom | 10h. Pode confirmar?";
  confirmação "Confirmado! Te esperamos às 9h. 💚"; véspera "Amanhã é dia de servir. Altar · BN Estoril · Dom | 17h.";
  troca "O João pediu uma troca com você: Altar · BN Estoril · Quarta | 19h30. Aceita?";
  não consigo "Tudo bem. Obrigado por avisar com antecedência; seu líder já foi avisado.";
  pós-culto "Obrigado por servir hoje. Deus usa pessoas improváveis, inclusive você. 💚"; erro "Não deu certo. Tente de novo em instantes.".
- **Qualidade**: celular primeiro (390px sem rolagem horizontal; alvos ≥ 44px; ação principal na parte de baixo),
  desktop ≥ 1024px com layout próprio; foco visível; `prefers-reduced-motion`; contraste AA (a tabela da referência
  diz o que pode e o que não pode); estados vazio/carregando/erro desenhados; textos em pt-BR natural.

## 7. Rotas do cliente
`/` início (moldura de anéis, "escalas", entrar com o link recebido, "sou líder") ·
`/e/:token` escala do ministério pelo link do grupo · `/v/:token` minha escala (link pessoal) ·
`/lider` login · `/lider/painel` (`?m=` ministério) · `/lider/cultos` · `/lider/equipe` · `/lider/importar` ·
`/lider/exportar` · `/lider/ajustes` · `/lider/telao/:cultoId` · `/dev/ui` (mostruário, só em desenvolvimento).

## 8. Donos dos arquivos (fase de construção)
- **A1 domínio**: `shared/dominio/**`, `tests/dominio/**`.
- **A2 servidor**: `server/**` (exceto `server/vite.ts`, `server/env.ts`), `tests/api/**`, `scripts/` de servidor.
  Pode acrescentar a `shared/api.ts`/`shared/validacao.ts`/`shared/schema.ts` só o que faltar, sem quebrar nomes
  existentes, registrando em `docs/notas/A2.md` (e gerando migração se mudar o schema).
- **A3 design system**: `client/src/estilos/**`, `client/src/ui/**`, `client/src/telas/dev/**`, `docs/DESIGN.md`.
- **A4 telas do voluntário**: `client/src/telas/publico/**`, `client/src/telas/voluntario/**`, `client/src/lib/**`
  (cliente HTTP e hooks de dados, compartilhado com A5 — A4 cria primeiro; A5 acrescenta os hooks do líder num
  arquivo próprio `client/src/lib/apiLider.ts`).
- **A5 telas do líder**: `client/src/telas/lider/**`, `client/src/lib/apiLider.ts`.
- **A6 integração**: `client/src/App.tsx`, `client/src/main.tsx`, `tests/e2e/**`, `README.md`, `replit.md`,
  `docs/arquitetura.md`, e correções mínimas em qualquer arquivo (registradas em `docs/NOTAS-INTEGRACAO.md`).
Divergência de contrato? Programe contra este SPEC e registre em `docs/notas/<SEU-ID>.md`.
