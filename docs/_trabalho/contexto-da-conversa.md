# Contexto da conversa (até 25/11/2026)

Resumo das decisões e pedidos do Yan desde o começo do projeto, para quem não viu a conversa (outras sessões, agentes, outra IA). O registro mais novo está em [[registro-25-11-2026]]. Quando os dois discordarem, vale o mais novo. Quando o Yan e as apostilas discordarem, valem as apostilas, palavra dele.

## Quem e o quê

- O Yan é líder de home church e serve no altar da Boas Novas Church (BN Estoril, Belo Horizonte; Instagram @boasnovaschurch; site boasnovaschurch.com). Ele não é programador e quer respostas em português claro.
- O projeto começou como a escala dos homens que servem no altar, que hoje é uma lista no WhatsApp. Virou a reconstrução de todas as abas do app atual da igreja (App BNC, da plataforma InChurch), mais módulos novos:
  - hierarquia e acessos;
  - escalas (a maior dor);
  - Kids, com check-in, controle dos pais e retirada;
  - home churches, com mapa e check-in;
  - agenda e palavras;
  - pedidos de oração;
  - unidades;
  - contribua;
  - eventos pagos;
  - Jornada BN;
  - o site da igreja.
- **Repositório:** lokal220/boasnovas, privado. O app vai ser construído no Replit, seguindo a skill metodo-lokal, que está em `.claude/skills/metodo-lokal`.
- **Fase 1:** só o protótipo visual clicável, sem nada conectado ("o fundamento da casa"), em um link para mostrar à liderança. Padrão pedido: "nível Instagram, Google, iFood", sempre dentro da referência visual da igreja.

## Decisões de produto

- Um login só para todos: e-mail e WhatsApp, com código no WhatsApp.
- Dois níveis de acesso: moderação e conta comum. A moderação liga funções nas contas comuns: líder de home church, líder de escala, equipe do kids, intercessão e comunicação. Os pastores presidentes são a moderação e podem autorizar um secretário.
- A hierarquia deve ser parecida com a da VAI DE LOKAL: poucos papéis, uma lista do que cada um pode, e o servidor decide o que cada um vê pelo login.
- **Home church:**
  - uma por líder;
  - o endereço vira um pino no mapa;
  - qualquer pessoa pode pedir para participar;
  - o líder aprova;
  - depois de 3 visitas seguidas a pessoa vira participante (decisão de 25/11, que substitui as 2 visitas de antes);
  - pode ter Líder e Anfitrião.
- **Kids:** etiqueta na impressora de etiquetas, controle dos pais e retirada. O My Kids, usado hoje por fora, serve de inspiração.
- **Eventos da igreja podem ser pagos:** Pix confirmado pelo banco, ingresso com QR.
- **Fluxograma:** mostra onde entra cada processo, inclusive os eventos pagos.
- **Jornada BN (12 passos):** a pessoa vira membro no Batismo (passo 4), com pelo menos 3 meses de igreja. O Epicentro (passo 6) é "para quem deseja servir" e o Ekballo (passo 11) é "para quem deseja ser líder de célula".
- **Escala:**
  - o formato é "Função · BN Unidade · Dia | hora";
  - regra da igreja: "Quando houver cultos/eventos fora dos dias fixos de culto, a escala será feita um dia antes";
  - na lista do WhatsApp, cada um põe o nome no dia em que pode servir, e algumas linhas têm "(Nome líder)", que é quem lidera aquele culto.
- **Escalas: respostas do Yan (25/11):**
  - quem manda em tudo são os Pastores Presidentes, que podem autorizar um secretário;
  - a montagem das escalas fica com a liderança de cada ministério (exemplo: o Staff, cuja líder é a Uleica);
  - o pedaço pode ser ministério e unidade juntos;
  - a escala do altar é um pedaço só, de quem cuida só do altar;
  - um ministério pode ser liderado por um casal;
  - o líder do ministério coloca as pessoas na equipe;
  - tudo fica dentro do app, só com cadastro: quem está no Staff vê as escalas do Staff;
  - a troca é direta por enquanto, com pedido de substituição para outro membro que serve;
  - Pastores de Rede ficam só na rede de home churches; nos ministérios, cada ministério tem um líder e há alguém que cuida de cada líder, no modelo Jetro (Êxodo 18:25).
- **Ministérios citados:** Consolidação (quem recebe as pessoas no altar), Intercessão (os que oram), Staff (os que servem no culto). Outros ainda vão chegar.

## Regras de trabalho (skill metodo-lokal)

- Português claro, sem jargão. Nunca inventar dado. Opinião honesta.
- A IA não publica o app nem mexe no banco. Quem roda o `db:push` é o dono.
- Prévia visual aprovada antes de qualquer código. Um commit por entrega. No ambiente de nuvem, o trabalho vai numa branch com pull request.
- Nada de emoji no que o cliente vê.
- Toda entrega termina com a lista do que mudou e um roteiro de teste numerado.

## Links

- Protótipo (site e app): https://claude.ai/artifact/DnQbJ9Lq4iPqTjoezaQFvs
- Referência visual oficial: `docs/marca/referencia-visual-boas-novas.html`
