# Mensagens automáticas, WhatsApp e CRM

## Sumário
1. Regras de toda mensagem automática
2. WhatsApp: oficial ou não oficial
3. A API oficial da Meta na prática
4. A caixa de entrada e o CRM
5. Régua de mensagens e comunicados

---

## 1. Regras de toda mensagem automática

- **Só sobe com `NODE_ENV=production`.** O ambiente de desenvolvimento roda
  junto, com os mesmos segredos.
- **Reservada no banco antes de sair,** com índice único: nunca sai duas
  vezes.
- **Nasce desligada,** com chave própria para o dono ligar.
- **Consentimento registrado** para tudo que não é aviso de serviço. **Saída
  registrada** também, com o link de saída em toda mensagem que não é aviso.
  "Saiu" não é "nunca aceitou". "Responda SAIR" sem gravação não vale.
- **Tetos baixos:** por dia, janela de horário e pausa automática depois de
  falhas seguidas. O excedente sai nos dias seguintes.
- **Mensagem que repete outra não sai.** Leia as que já saem antes de criar.
- **O texto lê prazo e valor das constantes do sistema.**
- **Falha de envio cai no e-mail de reserva** e conta no monitoramento: uma
  série de falhas vira alerta.

## 2. WhatsApp: oficial ou não oficial

- **O número que manda código de login não pode cair.** Se ele for bloqueado,
  cadastro e avisos param.
- **Gateway não oficial (Z-API e afins) não envia nada do sistema principal.**
  Disparo em grupo por gateway não oficial pode banir o número. Se o negócio
  precisar de grupo (um robô de ofertas, por exemplo), ele usa outro número,
  com envio e trava próprios, ligados só depois de o número estar certo.
- **API oficial direto na Meta, sem intermediário,** quando o sistema manda
  tudo pelo código: intermediário só soma mensalidade.
- **Na troca de envio, a ordem importa,** e o mesmo número não fica nos dois
  lugares. Escreva a sequência do dia para o dono, passo a passo, com o que
  acontece se inverter.
- **Trava no código:** sem a chave de envio ligada, a função de envio não
  manda nada, devolve falso e conta a falha. Um teste falha se alguém chamar
  o caminho antigo.

## 3. A API oficial da Meta na prática

- **Mensagem que o sistema inicia precisa de modelo aprovado:**
  - autenticação para código;
  - utilidade para aviso, lembrete e repasse;
  - marketing para promoção, que exige consentimento.
- **A análise humana da Meta reclassifica:** o que você mandou como utilidade
  pode voltar como marketing (mais caro e com regra de consentimento).
  Escreva o modelo com cara de serviço: fato, prazo, ação.
- **Dentro de 24 horas da última mensagem da pessoa,** a resposta é texto
  livre. Fora disso, só modelo.
- **"Aceito" não é "entregue":** o status chega pelo webhook. O webhook
  confere a assinatura com o segredo do app e só aceita os números da
  empresa.
- **Coexistência** (o número no app WhatsApp Business e na API ao mesmo tempo)
  só entra por Solution Partner ou Tech Provider. Com ela, a resposta dada pelo
  celular chega como "eco" (`smb_message_echoes`) e precisa entrar na caixa e
  tirar a IA da conversa.
- **IA de uso geral é proibida na API da Meta;** IA que atende os clientes da
  própria empresa é permitida. Leia os termos antes de ligar.
- **Preço por mensagem** (utilidade e autenticação no Brasil, por volta de
  US$ 0,007). Confira na documentação, porque muda.
- **Todo modelo novo precisa de nome em português na caixa,** e um teste
  cobra. Na tela aparece "Encomenda disponível", não `encomenda_disponivel`.

## 4. A caixa de entrada e o CRM

Quando o número vai para a API oficial, ele sai do app de celular. **A caixa
de entrada tem de estar pronta NO DIA da troca:** sem ela, a resposta do
cliente fica sem ninguém olhando. Teste antes com o número de teste da Meta.

O que deu certo, depois de estudar Callbell, Kommo, Datacrazy e respond.io:
- **A caixa ocupa a tela.** Configuração (o número, a conexão) e treino da IA
  vão para abas. No topo, dois selos: conexão e IA ligada.
- **Em cima da lista, três números:** Precisa de você, Abertas e Resolvidas.
  Vermelho só no que precisa de você.
- **Aviso automático não abre conversa e não sobe a conversa:** a lista é
  ordenada pela última mensagem DA PESSOA. Conversas só com aviso ficam em
  "Só avisos", no pé, para conferir se chegou ou falhou. É regra de leitura:
  não precisa mexer no banco.
- **No topo da conversa:**
  - um botão principal (Assumir, Devolver ou Reabrir);
  - o ✓ de resolver;
  - o ⋯ com "Ensinar a IA" e a ficha.
- **A ficha ao lado da conversa só lê,** com os valores da mesma conta da tela
  do cliente, e avisa se o celular é confirmado ou não.
- **Etiquetas e notas em tabelas próprias,** lidas com `optional()`: a tabela
  das conversas é lida inteira.
- **A janela de 24 horas é uma linha curta embaixo da resposta.**
- **Sugestões de resposta da IA** em cima do campo de resposta (ver
  `assistente-de-ia.md`).
- **Funções que o dono recusou ficam fora até ele pedir:** funil de vendas e
  "temperatura" de lead servem para equipe de vendas, não para suporte.

## 5. Régua de mensagens e comunicados

- **Comunicado tem teto diário somado** (50 por dia na VAI DE LOKAL) e dois
  tipos:
  - novidade: só para quem aceitou;
  - aviso de serviço (preço, regra, termos): para todos os confirmados, menos
    quem saiu.
- **Pergunta se responde na conversa, não em link:** a pessoa responde a
  mensagem e a equipe conversa ali.
- **O primeiro toque espera** (30 dias depois do cadastro para quem nunca
  usou), e a pergunta para quem parou tem intervalo mínimo entre uma e outra.
