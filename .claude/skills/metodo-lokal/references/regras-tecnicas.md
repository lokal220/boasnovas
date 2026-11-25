# Regras técnicas que evitam desastre

Cada regra tem a data e o incidente que a criou. Em situação nova, procure a
regra cujo porquê se parece com o seu caso.

## Sumário
1. Banco
2. Dinheiro
3. Prova (fotos e registros)
4. Rotas e o contrato com o app antigo
5. Mensagens e rotinas automáticas
6. Segurança e dado pessoal
7. Tela e navegador (o que quebra no celular)
8. Testes
9. Dependências e ambiente

---

## 1. Banco

- **Dois jeitos de ler o banco, e a escolha importa** (modelo em
  `assets/banco-optional-exigido.ts.modelo`):
  - `optional(rótulo, valorSeguro, fn)`: engole o erro, registra
    "feature degradada" e devolve o valor seguro. Serve para leitura que pode
    vir vazia (a tela mostra menos, mas mostra) e para efeito colateral (o
    aviso não sai, mas a ação acontece).
  - `exigido(rótulo, fn)`: deixa o erro subir, traduzido. "relation does not
    exist" vira "Esta parte precisa de uma atualização do banco: rode db:push
    e publique de novo." Serve para TODA ação que a pessoa pediu: salvar,
    apagar, escolher. Um formulário já fechou como "salvo" sem ter gravado
    nada, porque a tabela não existia.
  - **Número que vira pagamento, baixa ou trava usa a leitura que estoura.**
    Numa revisão, três leituras com `optional()` viravam "zero" numa queda do
    banco, e dali saíam baixa de pagamento, categoria duplicada e exclusão
    liberada.
- **Tabela nova é lida com `optional()`:** sem o `db:push`, o app segue no ar e
  só aquela função fica quieta. Isso permite publicar o código antes do banco.
- **Coluna nova em tabela lida inteira derruba o app** (31/08/2026). Sem o
  `db:push`, todo `select()` sem lista de colunas quebra. Antes de propor
  coluna, pergunte se a tabela é lida inteira em algum lugar. Se for, a
  proposta já nasce como tabela à parte, com chave para a linha original.
- **`db:push` é do dono, manual.** O Pull nunca altera o banco: o
  `drizzle-kit push --force` automático aprovava até o que apaga dado.
- **Nunca remover coluna ou tabela como "limpeza".** Parece sobrando?
  Pergunte.
- **Nunca seed, mock ou dado de teste no banco de produção.**
- **Nunca rodar comando no banco.** Escreva o comando e entregue ao dono.
  Script de correção (por exemplo, completar registros antigos) roda primeiro
  sem gravar e mostra o que faria; o dono roda com `--aplicar` depois de ler.
- **Gravação idempotente:** mensagem automática, crédito e lição têm reserva
  com índice único antes do trabalho. Com duas instâncias no ar, só uma faz.
- **Função que grava com lista de campos precisa de teste que confira a lista
  contra quem chama.** A aprovação de agência mandava horário e documentos, a
  função gravava uma lista fixa, e o resto sumia sem erro nenhum por dois
  meses.

## 2. Dinheiro

- **Valor sempre em centavos**, inteiro. `,00` colado à mão num texto é
  sempre o mesmo bug: um repasse de R$ 55,50 saía como R$ 55,00 no WhatsApp.
- **A regra de dinheiro mora num lugar só, e a função recebe a coisa
  inteira.** A taxa de guarda continuava correndo depois da retirada só na
  conta que o cliente via: a regra de congelar existia no faturamento, não
  nela.
- **"Pago" é fato:** nada devido E o comprovante (código de retirada, recibo)
  existe. "O valor a pagar é zero?" respondia "está paga" para uma cortesia
  ainda não aplicada, e a tela mostrou um QR "null" por três semanas.
- **Dinheiro guarda de onde veio** (pago, cortesia, bônus). Um estorno
  devolvia tudo como saldo sacável, inclusive a cortesia que o cliente nunca
  pagou.
- **Estorno é uma transação só, com o registro travado.** Dois cliques não
  podem devolver duas vezes.
- **Regra que protege dinheiro vale em TODOS os caminhos que creditam:**
  webhook, tela de confirmação, rotina de conferência e conciliação diária.
  Liste-os antes de dizer que está protegido. "Pix pago e devolvido não
  credita" entrou só num caminho, e o provedor manda webhook na própria
  devolução.
- **`as any` numa chamada que grava dinheiro esconde exatamente o campo que
  falta.** Uma indicação nunca gravou quem indicou, e ninguém recebeu a
  comissão.
- **Coluna que vira legado: procure TODOS os leitores,** porque mensagem, push
  e log também são tela.
- **Mudança de preço tem data de corte futura e vale pelo dia do fato** (a
  chegada, o pedido), não pela publicação. O que já foi avisado não muda de
  preço.
- **O servidor diz o estado do dinheiro, nunca o relógio da tela:** quem diz
  que um Pix expirou é o servidor.
- **Arquivo de dinheiro entra na trava de permissão** (`ask` no
  `.claude/settings.json`), e toda mudança nele é avisada ao dono.

## 3. Prova (fotos e registros)

- **Foto de entrada e de entrega é a prova da empresa quando o cliente diz que
  não recebeu.** Upload, caminho, retenção e quem pode ver são área crítica.
- **Foto nunca fica solta no aparelho:** foto guardada no celular acaba no
  registro errado. O que se guarda no aparelho é listado campo a campo.
- **Resposta com cache longo só pode ter endereço fixo se o conteúdo nunca
  muda.** A foto da entrega saía como a da chegada porque o endereço era o
  mesmo e o navegador guardava 24 horas. A versão vai no endereço.
- **Foto em base64 não entra em lista:** pesa e derruba a tela.
- **Material comercial é promessa:** "tudo fica registrado" não se escreve se
  a foto é apagada depois de X dias. Confira contra o código.

## 4. Rotas e o contrato com o app antigo

- **O app aberto no celular de cada pessoa é uma versão antiga.** Não mude
  nome de rota, formato de resposta nem campo obrigatório sem avisar o dono do
  que quebra para quem está nela.
- **Campo novo em resposta é sempre acréscimo,** nunca troca. Documente no
  cabeçalho da rota: "campo novo, a tela antiga segue igual".
- **Campo obrigatório novo entra em duas etapas:** primeiro opcional, gravado
  como veio; obrigatório só depois que as versões antigas saíram (umas duas
  semanas).
- **Rota de cliente lista os campos que a tela usa,** nunca espalha a linha
  (`...agencia`). Chave Pix e documentos do parceiro iam para o celular de
  todo cliente, dentro da agência dele. Antes de gravar dado sensível numa
  tabela, procure toda rota que manda a linha dela inteira.
- **Rota assíncrona sem `try/catch` derruba o servidor no Express 4.** Rota
  pública, então, nunca fica sem. Excluir a conta derrubava o app para todos
  por um callback vazio `() => {}` num passo que tinha ordem.
- **Número que vem de fora ganha teto antes de virar `::int`.** Um celular
  digitado no campo de indicação passava do maior inteiro do Postgres e
  derrubava a conferência pública.
- **Comprovante (código confirmado, sessão do Google) se LÊ nas conferências e
  se GASTA só na hora de criar**, numa operação só. Conferência nova entra
  antes do gasto.
- **Endereço externo mora numa constante só,** com teste que confere o nome.
  Um endereço errado de API foi copiado na lista de segurança, e os dois erros
  se confirmavam.
- **Duas portas para a mesma casa têm a mesma fechadura:** cadastro por e-mail
  e por Google passam pelas mesmas regras (CPF, idade, termos).

## 5. Mensagens e rotinas automáticas

- **Rotina que envia sozinha só sobe com `NODE_ENV=production`.** O workspace
  de desenvolvimento sobe sozinho depois do Pull, com os mesmos segredos, e
  duas cópias do servidor mandaram o mesmo aviso para a mesma cliente.
- **Toda mensagem é reservada no banco antes de sair** (índice único), para
  nunca sair duas vezes.
- **Texto que promete prazo lê o prazo do mesmo lugar que grava o
  vencimento.** A mensagem prometia 10 minutos para um código de 5.
- **"Aceito" não é "entregue":** a falha chega depois, pelo webhook.
- **Rotina nova nasce desligada** e tem chave própria, com tetos e pausa
  depois de falhas seguidas.
- **Envio crítico (código de login) não divide número com disparo arriscado**
  (grupos por gateway não oficial). Ver `mensagens-e-whatsapp.md`.

## 6. Segurança e dado pessoal

- **Arquivo de ambiente, chave e certificado não se abrem, não se leem, não se
  imprimem.** As travas em `settings.json` reforçam isso.
- **Variável nova:** diga o nome e para que serve, e o dono cadastra. Nunca
  peça para ele colar uma chave no chat. Nunca escreva chave no código.
- **Dado pessoal fora de log, de URL e de foto de tela.** Log de conversa
  registra só o final do telefone e o motivo, nunca o texto.
- **Limite contra robô sem punir quem tem dificuldade:** a proteção contra
  palpite é o código vencer no 5º erro. Limite por IP pune quem divide a rede
  da operadora. Limite de tempo conta pedidos, não conferências.
- **A IA não toma ação de dinheiro por mensagem:** o WhatsApp não pede senha.
  Ver `assistente-de-ia.md`.
- **Modo de teste nunca depende de "falta a chave":** quatro rotas tratavam
  "sem token" como teste e devolviam o código de recuperação na resposta.
  Teste é `NODE_ENV`, nunca a ausência de um segredo.

## 7. Tela e navegador (o que quebra no celular)

- **Consulta guardada sem prazo (`staleTime: Infinity`)** deixa a tela
  previsível, mas ela só muda quando alguém manda. Ao voltar para o app depois
  de 30 segundos, recarregue o que está na tela.
- **Lista que vem do servidor é conferida antes de usar:** num erro chega
  `{ message }` no lugar da lista, e o `.find` derruba a tela inteira.
- **Passo que manda a pessoa para OUTRO app** (ler código no WhatsApp, pagar no
  banco) **guarda o progresso fora da página:** rascunho no aparelho, prova de
  identidade na sessão do servidor. O celular descarta a aba parada, e login
  que abre outra aba não é confiável no celular.
- **Tela cheia com campo de digitar acompanha a área visível**
  (`visualViewport`), numa correção que mora num lugar só.
- **Se o CSS decide o que aparece, o JavaScript não pode ter outra conta.** O
  mapa ficou vazio no computador porque o JS montava os pinos só com uma aba
  que só existia no celular.
- **Telas que se revezam no mesmo lugar levam `key` própria,** e nunca se
  mistura `inset` com `top`/`bottom` no mesmo estilo. O React reaproveitou o
  elemento e a tela de validação foi parar fora da tela.
- **Tela que retorna cedo leva junto o que precisa** (o visualizador de foto,
  o modal). Comentário que promete comportamento precisa de teste.
- **A saída de emergência não mora dentro da coisa que falhou:** o botão
  "digitar código" ficava dentro do leitor de QR, que não aparece quando a
  câmera falha.
- **Trabalho começado no balcão não depende da tela continuar aberta:** o
  atendimento fica guardado no aparelho (sem foto) e volta por um cartão "Em
  atendimento".
- **`hidden` não esconde elemento com `display` próprio:** use
  `[hidden] { display: none !important }` no escopo.
- **Tamanho de imagem vai no CSS:** o Tailwind ignora o atributo `height` do
  `<img>`.
- **Camadas fixas:** o que cobre a tela (modal, gaveta) usa z-index 200, a
  barra do topo 100 e a barra de baixo do celular 50.
- **Campo de texto com letra de 16 px ou mais,** porque abaixo disso o iPhone
  dá zoom. Código de 6 dígitos é UM campo desenhado como seis caixas: colar
  tem de funcionar.

## 8. Testes

- **Teste com data fixa passa a data em TODA chamada que aceita data.** O
  `now = new Date()` esquecido é o relógio entrando pela porta dos fundos, e o
  teste quebra no dia seguinte.
- **Teste que lê o código-fonte trava decisões:**
  - todas as rotas do arquivo são só do admin;
  - nenhuma rota chama a função antiga de envio;
  - a lista de campos da rota de cliente é esta;
  - o texto mora na constante;
  - nada de emoji nas telas do cliente.
- **Teste de contraste calcula a partir do CSS,** nos dois temas.
- **Teste que conta coisas** (rotas, modelos) é uma lista viva. Ao criar algo
  de propósito, atualize a contagem com comentário, e conte ao dono.

## 9. Dependências e ambiente

- **`package.json`, lockfile, `.replit` e scripts ficam na trava de
  permissão.**
- **Pacote instalado pelo agente da hospedagem pode gravar endereço interno no
  lockfile** (`package-firewall.replit.local`). Se o `npm ci` falhar fora
  dela, é isso, não falta de internet.
- **PC com pouca memória:** ferramenta local tem de ser leve e rodar no
  processador.
