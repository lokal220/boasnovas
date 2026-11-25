# Lições que custaram caro

Cada lição é um incidente real da VAI DE LOKAL, contado em duas linhas, e a
regra que saiu dele. Leia antes de mexer em área sensível, ou quando uma
mudança parecer "óbvia demais": várias destas começaram assim.

## Sumário
1. Processo e trabalho com o dono
2. Banco e servidor
3. Dinheiro
4. Telas e celular
5. Texto e mensagens
6. Segurança

---

## 1. Processo e trabalho com o dono

- **O painel que saiu fora da prévia.** A prévia foi aprovada, e a construção
  copiou o jeito de outra tela. O dono achou "confuso, muita coisa fora do
  lugar". → Com prévia aprovada, a prévia é a especificação.
- **A tela redesenhada além do pedido.** O dono pediu um detalhe; a prévia
  redesenhou a tela, ele aprovou sem perceber, e o cliente perdeu o botão que
  usava. Voltou no mesmo dia. → Em tela em uso, mude só o nomeado. Se a prévia
  vai além, diga em uma linha.
- **Duas entregas em cima de uma API que o dono já tinha testado e achava
  ruim.** → Antes de construir em cima de ferramenta de fora, pergunte se ele
  já testou.
- **Copy sem vida por três rodadas,** até usar o método da referência. A
  primeira tentativa copiou a forma de um post só. → Estude o post-método da
  referência antes de escrever.
- **O ajuste feito só no painel do cliente,** com o parceiro ficando com a
  versão velha. → O mesmo ajuste vale para os dois painéis.
- **Diff aprovado com colunas, construído com tabela.** A construção mudou o
  desenho do banco depois do OK. → O desenho que muda na construção volta para
  aprovação.
- **Número na prévia sem fonte** ("20 letras cabem") e **CEP de exemplo
  errado** no roteiro de teste: o app estava certo e parecia errado. → Número
  e exemplo se conferem na fonte antes de ir.
- **Conserto na causa errada.** O primeiro conserto da validação "fantasma"
  mirou no decodificador do Android; só REPRODUZIR (build local e câmera
  simulada) achou a causa real. → Quando a leitura do código não explica o
  sintoma, reproduza antes de consertar.
- **Commit com a mensagem de outro commit.** O arquivo de mensagem tinha o
  nome de um antigo, a gravação do novo falhou e o commit usou o velho. →
  Mensagem por stdin, e o commit só depois de a mensagem existir. Histórico
  publicado não se reescreve: corrige-se com um commit vazio, com o OK do dono.

## 2. Banco e servidor

- **Coluna nova derrubou o app** (31/08). Sem o `db:push`, todo `select()` sem
  lista de colunas quebrou. → Tabela lida inteira não ganha coluna: ganha
  tabela à parte, lida com `optional()`.
- **`db:push --force` automático no Pull** aprovava o que apaga dado. → O
  banco é do dono, manual.
- **Formulário que fechou como "salvo" sem salvar,** porque a leitura engolia
  o erro da tabela que faltava. → Ação pedida usa `exigido()`.
- **Excluir conta derrubava o servidor para todos:** um logout sem esperar
  terminar e um callback vazio. → Passo com ordem não tem `() => {}`; rota
  async tem `try/catch`.
- **Um celular no campo de indicação derrubava o servidor** (`::int` estourado
  numa rota pública). → Número de fora ganha teto, e rota pública tem
  `try/catch`.
- **A agência aprovada nascia sem horário:** a função gravava uma lista fixa
  de campos e ignorava o resto em silêncio. → Teste confere a lista contra
  quem chama.
- **Publicação que falhou ao iniciar** sem que a checagem local pudesse dizer
  por quê: o build local era só do cliente. → Monte o servidor igual à
  hospedagem e suba uma cópia isolada.
- **O lockfile com endereço que só existe na hospedagem** quebrou a instalação
  no PC novo. → `replit.local` no lockfile é isso, não falta de internet.

## 3. Dinheiro

- **Dívida fantasma:** a taxa seguia correndo depois da retirada, só na conta
  que o cliente via. → Regra de dinheiro num lugar só, e a função recebe a
  encomenda inteira.
- **"Pago" sem código de retirada:** "valor zero" foi lido como "pago", e um QR
  "null" travou o balcão por três semanas. → "Pago" é fato: nada devido E o
  código existe.
- **Estorno que devolvia tudo como dinheiro sacável,** inclusive a cortesia, e
  dois cliques devolviam duas vezes. → Dinheiro guarda a origem; estorno é uma
  transação só.
- **Proteção num caminho só:** "Pix devolvido não credita" valia na
  conferência diária, não no webhook nem na tela. → Liste todos os caminhos
  que creditam.
- **`optional()` em conta de dinheiro:** queda do banco virava "zero", e dali
  saíam baixa e exclusão liberada. → Número que vira pagamento usa a leitura
  que estoura.
- **Indicação que nunca gravou quem indicou,** escondida por um `as any`. →
  `as any` em gravação de dinheiro é proibido.
- **Repasse de R$ 55,50 anunciado como R$ 55,00:** a coluna legado em reais
  inteiros e um `,00` colado à mão. → Coluna legado: procure todos os
  leitores, inclusive mensagem e push.
- **Preço novo valendo pelo dia da publicação:** um envelope registrado às 23h
  mudaria de faixa. → Preço vale pelo dia do fato, com data de corte futura.

## 4. Telas e celular

- **Recibo sem a foto da entrega:** cache de 24 horas num endereço que não
  mudava. → Conteúdo que muda leva a versão no endereço.
- **Validação de retirada fora da tela:** telas que se revezavam no mesmo
  lugar, sem `key`, e `inset` misturado com `top`/`bottom`. → `key` própria
  para cada tela; nada de misturar os dois.
- **Cadastro pelo Google que ficou branco:** a aba foi descartada enquanto a
  pessoa lia o código no WhatsApp, e a confirmação só existia na memória da
  página. → Quem sai do app guarda o progresso fora da página (sessão no
  servidor).
- **Atendimento do balcão que sumia ao sair da tela.** → Trabalho começado não
  depende da tela aberta; guarda no aparelho, campo a campo, sem foto.
- **Sem câmera, ninguém validava retirada:** o atalho morava dentro do leitor
  que falhou. → A saída de emergência não mora dentro da coisa que falhou.
- **O pino do mapa que escolhia em silêncio.** → Ação que muda escolha é botão
  com verbo escrito.
- **Mapa vazio no computador:** o CSS e o JS decidiam a mesma coisa por
  caminhos diferentes. → Uma conta só.
- **Modo escuro "bugado ao escrever":** sem `color-scheme`, os campos ficavam
  claros; e um token servia de texto e de fundo ao mesmo tempo. → Token de
  texto e de fundo separados, e contraste calculado em teste.
- **O ponto verde piscando o tempo todo.** → Sinal que pisca quer dizer
  alguma coisa.
- **Cadastro com tudo numa tela,** para cliente com dificuldade de rolar. → Uma
  pergunta por tela, sem perder nada do que existia.
- **Convite que não vinculava:** dois fluxos usavam o mesmo parâmetro de
  endereço. → Parâmetro novo procura antes se o nome tem dono.

## 5. Texto e mensagens

- **Mensagem duplicada para cliente real:** o workspace de desenvolvimento
  rodava as rotinas com os mesmos segredos. → Envio só com
  `NODE_ENV=production`, e reserva no banco antes de enviar.
- **Mensagem que prometia 10 minutos para um código de 5.** → O texto lê o
  prazo da mesma constante que grava o vencimento.
- **"Prazo grátis" fazendo o cliente ler que o serviço é de graça.** → Nada
  anuncia gratuidade que não existe.
- **Duas dicas na régua, a primeira repetindo as boas-vindas.** → Mensagem que
  repete outra não sai.
- **O robô de grupos quase postou pelo número dos códigos.** A chave conferida
  era a errada ("Meta ligada" não é "gateway no outro número"). → Rotina de
  disparo tem trava própria, ligada só depois de o número estar certo.
- **Modelos da Meta reclassificados de utilidade para marketing** pela análise
  humana. → O modelo tem cara de serviço: fato, prazo, ação.

## 6. Segurança

- **Dump do banco com CPF e telefone versionado por meses.** → Dump no
  `.gitignore` desde o primeiro dia; o histórico não esquece.
- **Token do GitHub em texto puro no endereço do repositório.** → Revogar e
  nunca guardar token em URL.
- **Recuperação de senha que devolvia o código na resposta** quando faltava o
  token de envio ("modo de teste"). → Teste é `NODE_ENV`, nunca a falta de um
  segredo.
- **Chave Pix e documentos do parceiro indo para o celular de todo cliente,**
  por um `...spread` da linha da agência. → Rota de cliente lista os campos.
- **Limite de código que travava gente de boa-fé por 1 hora,** contando
  conferências e juntando todos de um IP. → A proteção é o código vencer no 5º
  erro; limite conta pedidos, por número, não por IP.
