---
name: metodo-lokal
description: O jeito de construir sistema do Yan, tirado de meses fazendo a VAI DE LOKAL (app em produção, com cliente, parceiro e dinheiro de verdade) com o Claude Code. Cobre o começo de um sistema do zero (entrevista, pilha, CLAUDE.md, arquivo de mentalidade, checagem antes do commit, travas de permissão), o ciclo de cada entrega (prévia visual antes do código, plano, testes que vigiam decisões, commit, roteiro de teste), as regras que evitam desastre (dinheiro em centavos, prova, banco sem derrubar o app, contrato com o app antigo, mensagem automática só em produção) e os padrões de assistente de IA, WhatsApp, CRM e copy. Use sempre que o Yan for criar, começar, planejar ou manter um sistema, app, site, painel, landing ou automação, mesmo que ele só diga "vou fazer outro sistema", "monta o projeto" ou "começa o app novo". Na VAI DE LOKAL, o CLAUDE.md e a MENTALIDADE de lá mandam.
---

# Método Lokal

Este é o jeito de trabalhar que construiu a VAI DE LOKAL: uma rede de pontos de
retirada de encomendas, em produção, com cliente pagando por Pix, parceiro
recebendo repasse, WhatsApp oficial, assistente de IA e dezenas de telas. Quem
construiu foi o Claude Code; quem decidiu, testou e publicou foi o Yan, dono do
negócio, que não é programador.

Tudo aqui saiu de uma decisão do Yan ou de um erro que custou caro. Por isso
cada regra vem com o porquê: em situação nova, é o porquê que diz o que fazer.

## A ideia central

**Sistema em produção não é um teste que falha: é dinheiro errado no bolso de
alguém ou prova que some quando o cliente reclama.** O método inteiro existe
para três coisas:

1. **O dono decide, enxergando antes.** Ele aprova o desenho numa prévia antes
   do código e testa cada entrega com um roteiro.
2. **Nada quebra em silêncio.** Toda decisão vira teste. Toda checagem roda
   antes do commit. Todo erro vira uma regra escrita.
3. **O conhecimento não mora na cabeça de ninguém.** Ele fica num arquivo de
   mentalidade que viaja para qualquer ferramenta, e no código com comentário
   do porquê.

## Quem é o dono e como falar com ele

- **Português claro, sem jargão.** Se precisar de um termo técnico, explique
  numa frase. Ele fala do negócio; responda no idioma do negócio ("o cliente
  vai ver X", não "o endpoint retorna Y").
- **Ele acompanha pelo celular** (Remote Control). A mensagem final de cada
  resposta precisa se sustentar sozinha. Se houver uma decisão para ele,
  termine com a pergunta e as opções escritas.
- **Opinião honesta, mesmo contra ele.** Quando ele estiver errado, discorde e
  explique o porquê. Ideia de fora que não serve, você descarta e diz por quê
  ("o que for delírio você descarta"). Concordar para agradar já custou
  entregas jogadas fora.
- **Nunca inventar dado.** Número sem fonte não entra em tela, copy, prévia nem
  roteiro de teste. Se o dado não existe, diga que não existe e proponha como
  passar a medir.
- **Antes de construir em cima de API, serviço ou ferramenta de fora,
  pergunte numa linha se ele já testou.** Uma vez foram duas entregas em cima
  de uma API que ele já conhecia e achava ruim.
- **Arquivo entregue vem com caminho clicável:** o link, o caminho completo e,
  quando der, o cartão do arquivo. Ele não procura nada nas pastas.
- **Orçamento de uso:** trabalhe direto. Workflow ou vários agentes só se ele
  pedir, porque o limite semanal é dividido com outras tarefas.

## Quem faz o quê

| A IA | O dono |
|---|---|
| Escreve o código, roda a checagem, faz commit e push na `main` | Faz Pull no Replit (ou onde estiver hospedado) |
| Escreve o comando de banco e entrega para ele rodar | Roda `db:push` quando a entrega pedir |
| Diz o nome e o uso de cada variável nova | Cadastra nos Secrets |
| Monta a prévia e o roteiro de teste | Aprova, testa no app e clica em Republish |

**A IA nunca publica e nunca roda comando no banco.** Publicar é decisão de
negócio. Comando no banco pode apagar dado sem volta: o `drizzle-kit push
--force` automático já fez isso.

**Na nuvem (Claude Code na web),** a sessão trabalha numa cópia do
repositório. Siga o jeito dela: o trabalho vai num branch com pull request, e
o dono revisa e faz o merge antes do Pull e do Republish. O resto do ciclo não
muda: a checagem antes do commit, o fechamento e o roteiro de teste. Os
comandos dos modelos usam `node`; o caminho do Windows no `verificar.sh`
(`/c/Program Files/nodejs/node.exe`) é só para o PC do Yan.

## Começando um sistema do zero

Leia `references/dia-zero.md` antes de qualquer código num projeto novo. Em
resumo:

1. **Entrevista curta:** o que o sistema faz e para quem, onde vai rodar, se
   passa dinheiro, se guarda prova, se manda mensagem sozinho e qual é a marca.
   As respostas decidem quais regras pesam mais.
2. **A pasta e os arquivos-base,** a partir dos modelos em `assets/`:
   - `CLAUDE.md`: as regras do projeto;
   - `MENTALIDADE-<SISTEMA>.md`: o retrato que viaja;
   - `verificar.sh`: tipos, testes e build;
   - `.claude/settings.json`: as travas de permissão;
   - `scripts/post-merge.sh`: o Pull sem mexer no banco.
3. **Identidade antes da primeira tela.** Cores (claro e escuro), fonte, logo
   e tom de voz vão numa prévia, e o dono aprova. Depois disso, tudo o que o
   cliente vê nasce dentro dela.
4. **Primeira entrega pequena e completa,** com teste, checagem, commit e
   roteiro. Ela prova o ciclo inteiro antes de o sistema crescer.

## O ciclo de cada entrega

Detalhes e modelos de mensagem em `references/ciclo-de-entrega.md`. A sequência:

0. **`git status` antes de tudo.** Mudança que não é sua (outra sessão, outra
   ferramenta)? Pare e avise: sem ponto de retorno limpo, não comece.
1. **Entenda o pedido e mude só o que foi nomeado.** Em tela que o cliente já
   usa, "deixa mais minimalista" é tirar o que sobra, não redesenhar. Ajuste
   em algo que existe em dois painéis (cliente e parceiro) vale para os dois,
   no mesmo nível, sem esperar ele pedir de novo.
2. **Mais de 3 arquivos: plano no começo da resposta.** Espere o OK quando o
   plano encostar em banco, dinheiro, prova ou rota que já existe. Nos outros
   casos, siga.
3. **Mudança visual passa por prévia** (um Artifact com dados de exemplo),
   publicada e aprovada antes do código.
   - **A prévia aprovada é a especificação:** construa conferindo peça por
     peça.
   - Se a prévia trouxer mais do que ele pediu, diga em uma linha o que muda
     além do pedido.
4. **Construa** com comentário que explica o porquê (de preferência citando o
   problema real que evita), cada regra num lugar só e testes que travam a
   decisão.
5. **Cheque:**
   - `bash verificar.sh` (tipos, testes, build);
   - se mexeu no servidor, monte o servidor igual à hospedagem e suba uma
     cópia isolada.
   Com qualquer falha, não faça commit. Nunca altere o `verificar.sh` para
   passar.
6. **Commit e push:**
   - um commit por entrega, com mensagem que diz o que mudou e por quê;
   - só os seus arquivos (`git commit -F - -- <caminhos>`);
   - push recusado: traga o novo da main e ponha o SEU commit, ainda não
     publicado, em cima;
   - o que já subiu nunca se reescreve.
7. **Feche a entrega:**
   - cada arquivo tocado, uma linha cada;
   - se precisa de `db:push`;
   - o commit a reverter se der errado;
   - o que você NÃO conseguiu verificar;
   - o roteiro de teste numerado, em passos que ele segue no app.
8. **Atualize a MENTALIDADE** quando houver decisão nova ou lição, e diga na
   resposta que atualizou.

Arquivos que ficam travados (schema, dinheiro, fotos, rotinas de envio,
configuração) pedem aprovação. Se ele não estiver por perto, faça o resto
primeiro, deixe essa edição por último e diga o que ficou esperando. Nunca
contorne a trava por outro caminho.

## As regras que não se negociam

Cada uma veio de um incidente. As histórias estão em `references/licoes.md`, e
o detalhe técnico em `references/regras-tecnicas.md`.

**Dinheiro**
- Valor sempre em centavos.
- A regra de dinheiro mora num lugar só. A função recebe a coisa inteira (a
  encomenda, o pedido), não pedaços dela.
- "Pago" é fato, não estimativa: nada devido E o comprovante existe.
- Dinheiro guarda de onde veio, e estorno é uma transação só, com o registro
  travado.
- Regra que protege dinheiro vale em TODOS os caminhos que creditam. Liste os
  caminhos antes de dizer que está protegido.

**Prova**
- Foto de entrada e de entrega é a prova da empresa quando o cliente diz que
  não recebeu. O caminho, a retenção e o upload dela são área crítica.
- Foto nunca fica solta no aparelho.

**Banco**
- Tabela nova é lida com `optional()`: sem o `db:push`, o app segue no ar e só
  aquela função fica quieta.
- Ação que a pessoa pediu (salvar, apagar) usa leitura que pode dizer não
  (`exigido()`). Falhar em silêncio é pior do que falhar.
- Número que vira pagamento, baixa ou trava nunca passa por `optional()`.
- Coluna nova em tabela lida inteira derruba o app sem o `db:push`: vira tabela
  à parte.
- Nunca remover coluna ou tabela como limpeza, nunca seed nem dado de teste no
  banco.

**Contrato com quem já usa**
- O app antigo continua aberto no celular das pessoas. Não mude nome de rota,
  formato de resposta nem campo obrigatório sem avisar o que quebra.
- Campo novo obrigatório entra em duas etapas: primeiro opcional, depois
  obrigatório.

**Mensagem automática**
- Rotina que envia WhatsApp, e-mail ou cobrança sozinha só sobe com
  `NODE_ENV=production`. O ambiente de desenvolvimento já duplicou mensagem
  para cliente real.
- Toda mensagem é reservada no banco antes de sair.
- Mensagem que não é aviso de serviço precisa de consentimento e saída
  registrados.

**Segredo e dado pessoal**
- Não abra nem imprima arquivo de ambiente, chave ou certificado. Variável
  nova: diga o nome e o uso, e o dono cadastra.
- Dado pessoal fica fora de log, de URL e de foto de tela.
- Rota do cliente lista os campos que a tela usa, nunca espalha a linha
  inteira do banco.

**Escopo**
- Faça só o que foi pedido. Achou outro problema? Aponte e pergunte.
- Não renomeie, não mova, não refatore o que funciona só porque passou por lá.
- Edite arquivo só com as ferramentas de edição, nunca por script.

## Quando algo dá errado

- **Avise na hora,** na própria resposta, antes de tentar consertar sozinho.
  Diga exatamente o que mudou e qual commit reverter.
- **Reproduza antes de consertar** quando a leitura do código não explica o
  sintoma. Um conserto já mirou na causa errada porque ninguém reproduziu.
- **Lição vira três coisas:** uma regra na MENTALIDADE, um teste que trava a
  volta e, se for o caso, uma linha nova no `CLAUDE.md`.

## Onde está cada assunto

| Quando | Leia |
|---|---|
| Projeto novo, ou projeto sem `CLAUDE.md` | `references/dia-zero.md` |
| Cada entrega: plano, prévia, checagem, commit, fechamento | `references/ciclo-de-entrega.md` |
| Banco, dinheiro, rotas, cache, celular, testes | `references/regras-tecnicas.md` |
| Qualquer tela, landing ou painel | `references/tela-e-identidade.md` |
| Copy, mensagem, landing, post, roteiro | `references/texto-e-copy.md` |
| Assistente de IA (chat, WhatsApp, sugestões, aprender sozinha) | `references/assistente-de-ia.md` |
| WhatsApp, e-mail, régua de mensagens, caixa de entrada, CRM | `references/mensagens-e-whatsapp.md` |
| Antes de mexer em área sensível, ou quando algo parece "óbvio demais" | `references/licoes.md` |

Os modelos prontos ficam em `assets/`:
- `CLAUDE.md.modelo`
- `MENTALIDADE.md.modelo`
- `verificar.sh.modelo`
- `settings.json.modelo`
- `post-merge.sh.modelo`
- `banco-optional-exigido.ts.modelo`
