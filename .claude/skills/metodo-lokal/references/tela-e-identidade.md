# Tela e identidade

## Sumário
1. A identidade manda em tudo que o cliente vê
2. Prévia antes do código
3. Mudar só o que foi pedido
4. Regras de tela que vieram de reclamação real
5. Landing e página de anúncio
6. Painel e números
7. Movimento e efeitos

---

## 1. A identidade manda em tudo que o cliente vê

- **Cores em tokens** (variáveis CSS), com valores para o claro e o escuro. A
  tela nunca usa o hex de outra paleta: laranjas, vermelhos e roxos "de
  biblioteca" espalhados tiveram de ser varridos.
- **Token de texto e token de fundo são coisas diferentes.** A cor da marca
  clara demais para letra pequena ganha um token `-text`, mais escuro. Verde,
  âmbar e vermelho da marca são de botão e ícone; letra pequena usa o `-text`.
  Exceção consciente é decisão do dono, anotada, e não se propõe de novo.
- **Contraste calculado, não no olho:** teste que lê o CSS e reprova abaixo do
  mínimo, nos dois temas. O app avisa o navegador do tema (`color-scheme`),
  senão campo e preenchimento automático ficam claros no escuro.
- **Nada de emoji no que o cliente vê.** É o único elemento que a marca não
  controla: cada aparelho desenha o seu. Use ícone de linha, no traço da
  marca. Emoji fica só em texto que vira MENSAGEM (WhatsApp de compartilhar,
  frases prontas).
- **Fundo:** a VAI DE LOKAL tirou o creme de tudo ("o fundo branco dá um
  destaque muito melhor"). O cartão se separa pela borda fina, não pela cor.
  Num sistema novo, essa é uma decisão do dono, tomada na prévia de
  identidade.
- **Logo:** nunca redesenhar, distorcer, contornar ou pôr sombra. Logo de
  outra empresa (loja, marketplace) só onde o dono autorizou, e com o aviso de
  que a marca é de terceiros quando for o caso.
- **A landing é a referência visual, e o app se alinha a ela.**
- **Ícone de linha num círculo da cor clara da marca** para tela vazia e de
  aviso: um componente só.

## 2. Prévia antes do código

- Toda mudança visual que o cliente vê passa por uma página de prévia
  (Artifact) que o dono aprova em poucas palavras ("Fonte B, pode construir").
- **A prévia mostra a tela real com só a mudança,** em dados de exemplo
  conferidos, no celular e no computador quando os dois usam.
- **Aprovada, ela é a especificação.** Ao construir, confira peça por peça. O
  que quiser a mais, pergunte.
- **Escolha entre opções:** quando a decisão é de gosto (fonte, headline,
  modelo A ou B), mostre 2 a 4 opções, ou 10 se for headline, e recomende uma.
- **Quando ele aprova "o resto" e pede outra ideia de um pedaço,** atualize a
  mesma prévia.

## 3. Mudar só o que foi pedido

- **Em tela que o cliente já usa, mude só o que foi nomeado.** "Mais
  minimalista" é tirar o que sobra, não redesenhar cartões, abas ou o jeito de
  tocar. Uma tela redesenhada além do pedido voltou atrás no mesmo dia, porque
  o cliente perdeu o botão grande que já usava.
- **Separar não é simplificar:** quando uma tela vira várias (uma pergunta por
  tela), tudo o que a tela antiga tinha continua.
- **O mesmo ajuste nos dois painéis:** se cliente e parceiro têm a mesma coisa
  (notificações, configurações), o ajuste vale para os dois, adaptado ao que
  cada um vê. Isso não é sair do escopo: é o mesmo pedido.
- **Dois componentes que andam juntos mudam juntos** (o chat do app e o da
  landing, por exemplo).

## 4. Regras de tela que vieram de reclamação real

- **Confirmação aparece onde a pessoa está olhando.** Depois de pagar, ativar
  ou concluir: limpe o estado velho, releia o que mudou e leve a tela ao
  próximo passo. Aviso que nasce no topo com a pessoa rolada lá embaixo é,
  para ela, "não aconteceu nada".
- **Depois do sucesso, ilumine o caminho do próximo passo:** um botão grande
  com a ação seguinte ("Mostrar meu QR Code"). Se ela sair sem fazer, um
  holofote leva até ele, uma vez.
- **Uma interrupção por vez:** tutorial, pedido de notificação e pop-up não se
  empilham.
- **Fluxo de vários passos é tela cheia, não janela flutuante.** A janela serve
  para uma pergunta curta.
- **Ação que muda a escolha da pessoa é um botão com o verbo escrito,** nunca
  efeito colateral de um toque para ver. Tocar no pino do mapa escolhia a
  agência em silêncio.
- **Uma pergunta por tela para público com dificuldade** (rolar a tela já é
  barreira). Nome do campo em cima, sem ícone dentro, tudo alinhado à
  esquerda, barra fina de passos ("Passo 1 de 4 · E-mail").
- **Sinal que pisca precisa querer dizer alguma coisa:** o ponto verde
  pulsando o tempo todo incomodava ("esse trem piscando o tempo todo"). Agora
  só acende com resposta não lida.
- **Tela de dinheiro tem um lugar só para o valor** (o extrato). A tela de
  "Pix confirmado" mostra o que ficou liberado, não o valor de novo.
- **Busca ignora acento, maiúscula e ordem das palavras,** numa regra que mora
  num lugar só e vale na tela e no servidor.
- **Cartão informativo não reage ao toque:** parece link quebrado. O toque com
  resposta fica em botão e pergunta.

## 5. Landing e página de anúncio

- **A landing não tira a pessoa da página.** Do topo à chamada final, todo
  link é âncora da própria página ou o cadastro. O WhatsApp e os guias ficam
  só no rodapé.
- **Um elemento fixo só, no celular:** a barra de cima vira o botão principal
  ao rolar (a "ilha" que vira botão) e volta a ser barra perto do fim. Nada de
  botão fixo embaixo.
- **Página de anúncio pago é para converter, não para "namorar":**
  - botão grande e chamativo logo no topo, numa linha só no celular;
  - nada de texto explicando demais embaixo do botão;
  - a marca segura as regras do parceiro de afiliado (logo própria, cor
    própria nos botões), sem aviso desnecessário.
- **FAQ com poucas à vista e o resto no "Ver mais",** todas no HTML (para o
  Google).
- **O que o usuário aprende dentro da plataforma não vai para a página
  pública.**
- **Título, og:title, headline do JSON-LD e `<h1>` iguais;** descrição em até
  160 caracteres; endereço de página que já ranqueia não muda.

## 6. Painel e números

- **Número no painel vem com frase que explica.** Sigla solta (ARPU, LTV, CAC)
  vira número que ninguém usa.
- **O que não dá para medir aparece como "ainda não dá para medir", com o
  motivo,** nunca um veredito otimista.
- **O painel do dono é a caixa de entrada que ocupa a tela.** Configuração e
  treino vão para abas próprias. Vermelho só no que precisa de ação. Cada item
  da lista em duas linhas.
- **Menu grande vira grupos, com os fixados em cima.**

## 7. Movimento e efeitos

- **Efeito só enfeita o que já está na tela:** o risco se desenhando no
  título, o ícone dando um pulinho, o fio de progresso, o botão que afunda no
  toque. Bloco que entra ao rolar fica desligado, porque quem rola rápido vê
  vão branco.
- **"Menos movimento" do aparelho desliga tudo**
  (`prefers-reduced-motion`). Se alguém disser que "os efeitos morreram",
  confira essa opção antes de mexer no código.
- **Página "viva" não é página cheia:** mais vida no que já existe (botão que
  respira, reflexo no cartão, contador real de dados) sem acrescentar seção.
