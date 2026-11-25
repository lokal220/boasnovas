# Dia zero: começando um sistema novo

Leia isto antes da primeira linha de código de um projeto novo, ou quando
entrar num projeto que ainda não tem `CLAUDE.md`.

## Sumário
1. A entrevista
2. A pilha padrão (e quando trocar)
3. A pasta
4. Os arquivos-base
5. Identidade antes da primeira tela
6. A primeira entrega
7. O que a MENTALIDADE é, e o que não é

---

## 1. A entrevista

Faça poucas perguntas, de uma vez, em português de negócio. As respostas
decidem quais regras pesam mais. Proponha um padrão para cada uma, para ele só
dizer "isso" ou corrigir.

1. **O que o sistema faz, para quem, e qual é a ação principal** (o "comprar",
   o "agendar", o "retirar")? Quem são os perfis: cliente, parceiro, equipe,
   admin?
2. **Passa dinheiro?** Pix, cartão, saldo, sinal, comissão, repasse? Se sim,
   as regras de dinheiro (centavos, um lugar só, "pago é fato", todos os
   caminhos que creditam) valem desde o primeiro commit, e os arquivos de
   dinheiro entram na trava de permissão. Pergunte qual provedor de pagamento
   ele quer e se já testou algum. A VAI DE LOKAL usa a Efí para o Pix, com
   webhook e uma conferência diária; é o caminho conhecido, não obrigatório.
3. **Guarda prova?** Foto, assinatura, comprovante, registro de quem fez o
   quê? Se sim, a prova é área crítica.
4. **Manda mensagem sozinho?** WhatsApp, e-mail, push, cobrança. Se sim:
   `NODE_ENV=production`, reserva no banco antes de enviar, consentimento e
   saída registrados, tetos. Leia `mensagens-e-whatsapp.md`.
5. **Tem assistente de IA?** Se sim, leia `assistente-de-ia.md` antes de
   desenhar.
6. **Onde roda e quem publica?** O padrão é o Replit: a IA faz push no GitHub,
   o dono faz Pull e Republish.
7. **Marca:** nome, cores, fonte, logo, tom. Já existe ou nasce agora?
8. **Celular ou computador primeiro?** Quem usa no balcão, na rua, com pouca
   familiaridade com tela?
9. **Já testou alguma ferramenta ou API para isso?** O que achou?

Registre as respostas na MENTALIDADE, seção "Quem é e o que é" e "Como o negócio
funciona".

## 2. A pilha padrão (e quando trocar)

A VAI DE LOKAL roda nesta pilha, e ela aguentou produção:

- **Cliente:** React + TypeScript com Vite, TanStack Query para os dados do
  servidor, Tailwind só como base, com CSS próprio por tela quando o desenho
  pede. Tokens de cor em variáveis CSS (claro e escuro).
- **Servidor:** Node + Express + TypeScript, montado com esbuild num arquivo
  só.
- **Banco:** Postgres (Neon) com Drizzle ORM. O `db:push` é manual, do dono.
- **Hospedagem:** Replit (Secrets, Republish, workspace de desenvolvimento).
- **Testes:** `node --test` com `tsx`, sem framework pesado. Muitos testes leem
  o código-fonte e travam decisões (exemplo: "esta rota é só do admin",
  "o texto da mensagem lê o prazo da constante").
- **Pastas:** `client/`, `server/`, `shared/` (regras puras usadas pela tela,
  pelo servidor e pelos testes) e `tests/`.

Por que `shared/` importa tanto: a mesma pergunta respondida em dois lugares
vira duas respostas. Regra de dinheiro, de busca, de prazo e de "quando
aparece" mora em `shared/` como função pura e é chamada pela tela e pelo
servidor.

Troque a pilha só com motivo concreto (o dono pediu, a hospedagem não suporta,
o sistema é outra coisa, como app nativo ou automação). Diga o motivo numa
frase e peça o OK.

## 3. A pasta

O dono não é programador: ele precisa enxergar o que pode e o que não pode
mexer. O padrão que funcionou:

```
<SISTEMA> - PASTAS (NÃO APAGAR)/
└── <SISTEMA> (NÃO APAGAR)/           ← a pasta onde o Claude Code abre
    ├── CLAUDE.md                     ← as regras do projeto
    ├── MENTALIDADE-<SISTEMA>.md      ← o retrato que viaja
    ├── verificar.sh                  ← tipos, testes e build
    ├── .claude/settings.json         ← as travas de permissão
    ├── <SISTEMA>-GITHUB/             ← o repositório (o app)
    ├── BACKUP .../                   ← não se edita
    └── CHAVE-... -NAO-APAGAR-NUNCA/  ← chaves de loja de app; não se toca
```

A chave de assinatura do Android é a lição: cada download do gerador cria uma
chave nova, e sobrescrever a original trava o envio para a Play Store.

## 4. Os arquivos-base

Copie de `assets/` e adapte. Troque cada `[CAMPO]` e apague o que não se
aplica: sem dinheiro, a seção de dinheiro sai.

| Arquivo | Para quê | Detalhe |
|---|---|---|
| `CLAUDE.md` | As regras que a IA lê em toda sessão | Curto e duro: papéis, escopo, checagem, banco, dinheiro, prova, mensagens, contrato, segredos, o que fazer quando der errado |
| `MENTALIDADE-<SISTEMA>.md` | O retrato completo, para colar em qualquer ferramenta | Decisões com data e porquê, identidade, texto, regras técnicas, lições |
| `verificar.sh` | Checagem antes de todo commit | Tipos, testes e build; liberado nas permissões e proibido de editar |
| `.claude/settings.json` | Travas | Proíbe o que destrói (`git reset --hard`, `push --force`, `db:push`, `DROP`, ler `.env`); pede confirmação para schema, dinheiro, prova, rotinas de envio e configuração. No modelo, troque `[SISTEMA]` e os caminhos dos arquivos de dinheiro, foto e envio pelos do projeto novo; o JSON não aceita comentário |
| `scripts/post-merge.sh` | O que roda no Pull | Instala pacotes e NÃO mexe no banco |
| `banco-optional-exigido.ts` | Os dois jeitos de ler o banco | `optional()` para leitura que pode vir vazia; `exigido()` para ação que a pessoa pediu |

### Ligar o GitHub e a hospedagem (roteiro para o dono)

O dono não é programador, e as contas são dele. Você prepara tudo localmente
e entrega um roteiro numerado só com o que depende dele:

1. Ele cria um repositório **vazio e privado** no GitHub e manda o endereço,
   sem token. O login fica com o gerenciador de credenciais do Git no PC dele.
2. Você faz o primeiro commit (os arquivos-base, a estrutura e uma página
   mínima) e o push.
3. Ele cria o app no Replit importando do GitHub, liga o Postgres e cadastra
   os Secrets que você listou (nome e uso de cada um, nunca o valor).
4. Ele roda `npm run db:push` no Shell, se a entrega pedir, e clica em
   Republish.
5. Ele abre o endereço publicado e confere o que o roteiro diz.

A partir daí, o ciclo é sempre o mesmo: você faz push, ele faz Pull e
Republish. A hospedagem cria commits vazios de "Published your App" na
`main`: antes de começar, busque a `main` atualizada.

Também desde o primeiro commit:
- **`.gitignore`:** `.env*`, `dist/`, dumps de banco e chaves. Um backup com
  CPF e telefone já ficou versionado por meses.
- **Token nunca no endereço do repositório.** Um token do GitHub ficou em
  texto puro no remote e teve de ser revogado.
- **Secrets só nos Secrets da hospedagem.** O servidor não lê `.env`
  localmente. Sem a variável, a função avisa que está fora do ar e o resto
  funciona: a falta da chave da IA nunca derruba o site.

## 5. Identidade antes da primeira tela

Monte uma prévia (Artifact) com:
- as cores em tokens, nos temas claro e escuro;
- a fonte e a escala de texto;
- a logo no tamanho real;
- um botão, um cartão, um campo e uma tela vazia de exemplo.

O dono escolhe ali. Depois:

- **Tudo que o cliente vê nasce dentro dessa identidade,** sem exceção.
- **Cor só pelas variáveis do tema,** nunca o hex de outra paleta.
- **Um token que muda com o tema serve OU de texto OU de fundo, nunca dos
  dois.** Clarear um laranja para letra no escuro deixou ilegíveis os cartões
  que o usavam como fundo.
- **Cor nova passa pelo cálculo de contraste,** num teste que lê o CSS.

Veja `tela-e-identidade.md`.

## 6. A primeira entrega

Pequena e completa: uma tela ou uma rota de verdade, com teste, `verificar.sh`,
commit, push e roteiro de teste. Ela prova o ciclo inteiro (Pull, `db:push`,
Republish) antes de o sistema crescer, e mostra ao dono como cada entrega vai
chegar.

Logo cedo:
- **Monitoramento simples:** um alerta quando uma série de envios falha
  seguida. É assim que se descobre que um Secret sumiu.
- **A montagem do servidor igual à hospedagem,** para conferir a subida (ver
  `ciclo-de-entrega.md`).

## 7. O que a MENTALIDADE é, e o que não é

- **É** o arquivo que o dono leva para qualquer IA: ChatGPT, Cursor, outro
  agente. Colado lá, a ferramenta entende o negócio e o que não pode ser
  feito.
- **É** a memória das decisões, com data, palavras do dono e porquê. Exemplo:
  "o cadastro começa por e-mail ou Google (decisão do Yan, 23/09)".
- **Não é** substituto do código: quando os dois discordam, o código manda, e
  a MENTALIDADE é corrigida.
- **Cresce junto:** regra de negócio que muda, decisão nova ou algo que quebra
  e vira lição entram na mesma entrega, e a resposta avisa que atualizou.
