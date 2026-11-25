---
tipo: ministerio
tags:
  - ministerio
  - kids
  - criancas
  - my-kids
  - check-in
  - lgpd
status: confirmado
atualizado: 2026-11-25
fontes:
  - "registro-25-11-2026 (Kids: inspiração no My Kids)"
  - "contexto-da-conversa (decisões de produto)"
  - "print do app atual, 02-menu-mais-perfil.jpg"
  - "protótipo, telas kids, kids-balcão e plano"
---

# Kids

O Kids é o cuidado das crianças da Boas Novas Church durante os cultos, feito pela "equipe do kids". Hoje a igreja usa o app My Kids por fora, porque o app atual (InChurch) não faz o controle das crianças. O Yan pediu para usar o My Kids como inspiração e trazer esse controle para dentro do app novo, com etiqueta na impressora de etiquetas, controle dos pais e retirada, mas sem construir ainda. No app novo, "equipe do kids" é uma das funções que a moderação liga nas contas. As fontes não dizem quem lidera o Kids, quais são as salas e as faixas de idade, nem em quais cultos ele funciona. O detalhe das telas está em [[Kids no app]], e o que o My Kids faz, em [[My Kids]].

## O que se sabe

- **Hoje:** "A igreja usa o app My Kids por fora, porque o app atual (InChurch) não faz o controle das crianças. O Yan pediu para usar o My Kids como inspiração e trazer isso para dentro do app. **Ainda não construir.**" (registro de 25/11/2026)
- **O que o app novo terá** (contexto da conversa, decisões de produto): "Kids, com check-in, controle dos pais e retirada"; "etiqueta na impressora de etiquetas, controle dos pais e retirada. O My Kids, usado hoje por fora, serve de inspiração."
- **A função no app:** "equipe do kids" está entre as funções que a moderação liga nas contas comuns (contexto da conversa). Ver [[Moderação do app]].
- **No app atual:** o "Menu mais" tem um item "Kids" (print `02-menu-mais-perfil.jpg`). O print não mostra o que há dentro, e o registro diz que o app atual não faz o controle das crianças. Ver [[App atual (InChurch)]].
- **A mesma empresa:** o Voluts, que o [[Staff]] usa para as escalas, é da Gileade Sistemas Ltda, do grupo DB1, "a mesma empresa do My Kids" (registro de 25/11/2026).
- **Ministério?** O Kids não está na lista dos "ministérios citados até agora" (Consolidação, Intercessão e Staff). As fontes falam em "equipe do kids" e em "voluntários do kids". Ver [[Ministérios]].

## O que o My Kids faz, segundo o site dele

Lido em appmykids.com.br em 25/11/2026 e guardado no registro do mesmo dia:
- a família se cadastra uma vez, pelo app ou na recepção, com alergias, restrições e a lista de quem pode retirar a criança;
- a entrada é por QR code; a etiqueta é opcional e leva nome, sala e código de segurança;
- o visitante se cadastra sozinho por um QR, sem baixar nada, ou um voluntário faz o cadastro na hora;
- na saída, o app confere se quem retira é um responsável autorizado;
- durante o culto, a equipe manda alertas para o celular dos pais;
- cada culto vira uma reunião com as salas por faixa etária já montadas;
- mostra em tempo real quantas crianças entraram, quantas estão na sala e quantas já saíram;
- tem relatórios de frequência, de visitantes e das famílias que deixaram de vir;
- manda boas-vindas ao visitante pelo WhatsApp;
- os planos vão por quantidade de check-ins, a partir de R$ 29,90 por mês, e o site traz valores que não batem entre si.

## O que o app novo precisa fazer

**Já decidido** (contexto da conversa): check-in, controle dos pais e retirada, com etiqueta na impressora de etiquetas, e a função "equipe do kids".

**Já está no protótipo** (proposta, a confirmar):
- **Os pais:** fazem o check-in dos filhos pelo app ("Faça antes de chegar e só confirme no balcão."), recebem um código de retirada ("Só quem tem o código retira as crianças.") e mantêm a lista de "quem pode retirar". Para incluir alguém, o botão "Adicionar pessoa autorizada" pede "foto do documento conferida pela equipe".
- **A equipe, no balcão:**
  - vê a ocupação das salas e busca por família ou por código;
  - confirma a entrada, vendo as alergias na hora;
  - imprime duas etiquetas com o mesmo código, uma na criança e outra com o responsável;
  - na saída, confere o código do responsável e entrega as crianças;
  - cada entrega fica registrada ("a quem, a hora e quem conferiu") e "não pode ser apagada";
  - o botão "Chamar responsável" abre o WhatsApp do responsável.
- **O caminho:** Check-in, pelos pais no app → Balcão confirma e imprime as etiquetas → Na sala, com as alergias à vista da equipe → Retirada, só com o código do responsável → Registro de entrega, que não se apaga.
- **As salas** do protótipo (Maternal, Kids 1 e Kids 2, com lotação) são exemplo.
- **No plano de construção,** o Kids é a fase depois das escalas: "Família, check-in, etiquetas impressas, código de retirada, balcão e registro de entrega." Antes, a liderança decide "Salas, faixas de idade e o modelo da impressora de etiqueta."

**Recomendado para trazer do My Kids** (registro de 25/11/2026, proposta, a confirmar):
- cadastro único da família com a lista de quem pode retirar;
- na saída, conferir o código e também se a pessoa está na lista;
- cadastro do visitante pelo site, por QR, sem baixar o app;
- salas por faixa etária montadas sozinhas em cada culto;
- painel em tempo real para a coordenação;
- botão "chamar o responsável" que avisa no celular dos pais;
- relatórios, incluindo as famílias que deixaram de vir, que vão para a [[Consolidação]];
- boas-vindas no WhatsApp com consentimento, seguindo as regras de mensagem automática do método.

**Onde dá para ir além do My Kids** (registro de 25/11/2026, proposta, a confirmar):
- perfis de acesso da equipe do kids, no modelo de perfis do app;
- escala dos voluntários do kids junto com as outras escalas;
- capacidade por sala;
- retirada por outra pessoa autorizada na hora, pelo app dos pais;
- medicamentos e necessidades especiais;
- ligação com a Consolidação, as home churches e a Jornada.

**Cuidado com os dados** (registro de 25/11/2026, recomendação):
- "dado de criança só aparece para a equipe do kids em serviço naquele culto";
- "os pais veem só os próprios filhos";
- "toda consulta e toda mudança ficam registradas";
- "nada de dado de criança em log, em endereço de página ou em print".

O método de trabalho diz o mesmo para qualquer dado pessoal: "Dado pessoal fica fora de log, de URL e de foto de tela." Ver [[Método de trabalho]].

## Diferenças entre o protótipo e a recomendação

- **A retirada:** no protótipo, "Só quem tem o código retira". A recomendação pede conferir o código **e** se a pessoa está na lista de autorizados.
- **Chamar o responsável:** no protótipo, o botão abre o WhatsApp do responsável. A recomendação fala em um aviso que chega no celular dos pais.
- **A moderação:** no protótipo, quem tem a moderação abre todas as áreas, inclusive o balcão do Kids. A recomendação diz que dado de criança só aparece para a equipe do kids em serviço. Falta decidir. Ver [[Moderação do app]] e [[Perfis e permissões]].

## O Kids e os outros ministérios

- **Escalas:** a recomendação põe a escala dos voluntários do kids junto com as outras escalas (proposta, a confirmar). Ver [[Escalas]].
- **Consolidação:** os relatórios das famílias que deixaram de vir iriam para ela (proposta, a confirmar).
- **Epicentro:** se a regra de servir passa pelo passo 6 da Jornada, ela também valeria para os voluntários do kids. Isso ainda está aberto. Ver [[06 Epicentro]].

## Aberto

1. Quem lidera o Kids e quem cuida dessa liderança, no modelo Jetro.
2. As salas, as faixas de idade e a capacidade de cada sala.
3. O modelo da impressora de etiqueta.
4. Em quais cultos e em quais unidades o Kids funciona.
5. Como a escala dos voluntários do kids é feita hoje.
6. Se os cadastros das famílias que estão no My Kids vêm para o app novo.
7. O que cada pessoa da equipe do kids pode ver e fazer, e se a moderação vê dados das crianças.
8. Se o Epicentro vale para os voluntários do kids.

Essas perguntas também estão em [[Perguntas abertas]].

## Ligações

- [[Kids no app]]: o desenho do Kids no app novo, tela por tela.
- [[My Kids]]: o app que a igreja usa hoje por fora.
- [[Ministérios]]: o mapa dos ministérios.
- [[Consolidação]]: para onde iriam os relatórios das famílias que deixaram de vir.
- [[Escalas]]: a escala dos voluntários do kids.
- [[Staff]]: usa o Voluts, da mesma empresa do My Kids.
- [[Moderação do app]] e [[Perfis e permissões]]: a função "equipe do kids" e quem vê o quê.
- [[App atual (InChurch)]]: o item "Kids" do app de hoje.
- [[App Boas Novas]] e [[Protótipo]]: o app novo e a prévia clicável.
- [[06 Epicentro]] e [[Método de trabalho]].
- [[Perguntas abertas]].

## Fontes

- `docs/_trabalho/registro-25-11-2026.md`: seção "Kids: inspiração no My Kids (pedido do Yan, 25/11/2026)" inteira (uso do My Kids por fora, o que o site do My Kids diz que faz, o que o protótipo já tem, a recomendação para trazer, onde ir além, cuidado com os dados); seção "Voluts" (a mesma empresa do My Kids); seção "Ministérios (escalas)" (ministérios citados).
- `docs/_trabalho/contexto-da-conversa.md`: "Quem e o quê" (Kids com check-in, controle dos pais e retirada); "Decisões de produto" (função "equipe do kids"; etiqueta na impressora).
- `docs/referencias/app-bnc/02-menu-mais-perfil.jpg`: o item "Kids" no "Menu mais" do app atual.
- `docs/_trabalho/prototipo/prototipo-boasnovas.html` (proposta):
  - linhas 1009-1010: etapas "kids · família" e "kids · balcão";
  - linhas 1215-1220: tela dos pais;
  - linhas 1222-1229: balcão de entrada e retirada;
  - linha 1034: quem tem a moderação abre todas as funções;
  - linha 1331: o caminho do Kids no mapa dos processos;
  - linha 1342: fase "Kids" do plano.
- `.claude/skills/metodo-lokal/SKILL.md`: seções "Mensagem automática" e "Segredo e dado pessoal".
- Lista geral das fontes: [[Fontes]].
