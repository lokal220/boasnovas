# O ciclo de cada entrega, em detalhe

## Sumário
1. Antes de começar
2. O plano
3. A prévia visual
4. Construir
5. Checar
6. Commit e push
7. Fechar a entrega
8. Outra sessão mexendo na mesma pasta
9. Modelos de mensagem

---

## 1. Antes de começar

- **`git status` na pasta do app.** Mudança que não é sua: pare e avise. Pode
  ser outra sessão trabalhando ou um teste do dono. Sem ponto de retorno
  limpo, um erro seu se mistura com o trabalho de outro e ninguém consegue
  voltar só o seu.
- **Busque a `main` atualizada** (`git fetch` + avanço rápido). A hospedagem
  costuma criar commits vazios de "Published your App".
- **Leia antes de mexer.** Antes de reusar uma rota, leia o que ela recusa: o
  segundo passo de uma avaliação reusou a rota do primeiro sem a trava que já
  existia nela. Antes de criar parâmetro de endereço, procure se o nome já tem
  dono: dois fluxos com o mesmo `?encomenda=` apagaram o convite um do outro.
- **Pergunte só o que bloqueia.** O resto, resolva com o padrão mais sensato e
  diga qual escolheu.

## 2. O plano

Com mais de 3 arquivos, escreva o plano no começo da resposta:
- cada arquivo e o que muda nele;
- se encosta em banco, dinheiro, prova ou rota existente;
- se vai precisar de `db:push`.

Se encostar em uma dessas áreas, **espere o OK**. Nos outros casos, siga.

**Diff de schema:** mostre o diff e espere o OK antes do commit. Se o desenho
mudar na construção (a coluna virou tabela, por exemplo), ele volta para
aprovação: o OK foi para o outro desenho.

## 3. A prévia visual

Toda mudança que o cliente vê (tela, landing, fonte, texto de botão) passa por
uma página de prévia antes do código:

- **Dados de exemplo realistas, nenhuma pessoa de verdade.** Exemplo bom tem
  nome, valor e código plausíveis; valor e endereço conferidos na fonte.
- **A tela que já existe, com só a mudança.** Copie o visual atual e ponha a
  novidade, para ele ver o que muda de verdade.
- **Interativa quando o comportamento importa:** tocar, carregar, esconder,
  enviar.
- **Mostre computador e celular** quando os dois usam.
- **Uma seção "Como funciona"** com as regras em frases curtas: quando aparece,
  o que nunca faz, quanto custa.
- **Confira a prévia num navegador antes de mandar:** largura de celular, nada
  vazando para o lado, botão numa linha só, sem erro no console.

Depois da aprovação:
- **A prévia é a especificação.** Abra o arquivo dela ao construir e confira
  peça por peça. Um painel já foi construído "copiando o jeito de outra tela"
  em vez da prévia, e voltou como "confuso, muita coisa fora do lugar".
- **O que você quiser acrescentar, pergunte antes.**
- **Se a prévia trouxe mais do que ele pediu,** diga em uma linha fora dela.
  Uma tela foi redesenhada além do pedido, aprovada na prévia, e voltou atrás
  no mesmo dia, porque o cliente perdeu o botão que usava.
- **Ele pode aprovar com ajuste** ("gostei do 8, pode construir com ele"):
  construa com o ajuste e registre a escolha.

## 4. Construir

- **Comentário explica o porquê,** citando o problema real e a data:
  "/* Sem a tabela, desligada: o app não pode cair esperando o db:push. */".
  O cabeçalho do arquivo novo conta o pedido, a prévia aprovada e as decisões.
- **Cada regra num lugar só** (`shared/`), chamada pela tela e pelo servidor.
- **Teste que trava a decisão,** não só a função:
  - a rota é só do admin;
  - o texto lê o prazo da constante;
  - a rota de cliente lista os campos;
  - a conferência vem antes do gasto do comprovante.
  Testes que leem o código-fonte são válidos e baratos.
- **Edite só com as ferramentas de edição.** Nada de `sed -i`, script Python
  ou Node escrevendo arquivo do projeto: o diff fica imprevisível.
- **Não refatore** o que funciona só porque passou por lá. Se precisar mudar
  uma função usada em produção, prefira acrescentar um parâmetro opcional ou
  uma função de acesso a mexer no comportamento dela.

## 5. Checar

1. **`bash verificar.sh`:** tipos, testes e build. Nunca commitar com falha.
   Nunca alterar o script.
2. **Teste que conta coisas** (rotas, campos) falhou por causa de algo que
   você criou de propósito? Atualize a contagem com um comentário dizendo o
   que entrou, e conte isso ao dono. Atualizar teste para esconder um erro é
   outra coisa, e não se faz.
3. **O servidor:** o build do `verificar.sh` costuma montar só o cliente. Quando
   mexer no servidor, monte igual à hospedagem e suba uma cópia isolada por
   alguns segundos:
   - Montar:
     `node node_modules/esbuild/bin/esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --log-level=warning`
   - Subir:
     `env -i PATH="$PATH" NODE_ENV=test PORT=5099 DATABASE_URL="postgres://teste:teste@127.0.0.1:9/teste" timeout 25 node dist/index.js`
   - Código bom mostra o aviso de variáveis faltando e cai no erro de conexão
     com o banco de mentira. Erro de import, de sintaxe ou "before
     initialization" aparece antes disso.
   - `NODE_ENV=test` mantém as rotinas de envio desligadas.
4. **Diga o que não deu para verificar,** por exemplo: "a resposta da IA de
   verdade precisa da chave, que só existe na hospedagem".

## 6. Commit e push

- **Um commit por entrega.** A mensagem diz o que mudou e por quê, em
  português, e termina com a linha de coautoria pedida no projeto.
- **Só os seus arquivos:** `git add <seus arquivos>` e depois
  `git commit -F - -- <seus arquivos>`. Um `git commit` solto leva junto o que
  outra sessão deixou preparado.
- **A mensagem do commit vai por stdin (`-F -`),** nunca por um arquivo com
  nome reaproveitado. Um commit já subiu com a mensagem de outro, de três
  semanas antes, porque o arquivo antigo tinha o mesmo nome.
- **Push recusado** porque a `main` andou: veja o que entrou. Se o seu commit
  ainda não subiu, ponha-o em cima (`git rebase origin/main`) e confira que a
  árvore final é a mesma que passou na checagem (`git rev-parse HEAD^{tree}`
  antes e depois). Se o que entrou mexe nos mesmos arquivos, rode a checagem
  de novo.
- **O que já subiu nunca se reescreve:** nada de `--force` e nada de emendar
  commit publicado. Para corrigir uma descrição errada, use um commit vazio
  com a descrição certa, com o OK do dono.

## 7. Fechar a entrega

A resposta final traz, nesta ordem:

1. **O que está pronto e onde:** o commit, o que passou na checagem e o que
   falta (Pull e Republish, `db:push` ou não).
2. **O que não foi verificado,** dito sem rodeio.
3. **O caminho de volta:** reverter o commit tal.
4. **Arquivos:** cada um em uma linha, com o porquê.
5. **MENTALIDADE atualizada,** quando for o caso.
6. **Roteiro de teste numerado,** que ele siga no app, tela por tela, com o que
   deve ver. Começa com "No Replit, faça o Pull e o Republish" e inclui o
   caminho do que NÃO deve acontecer (exemplo: "na conversa da Hadassa, a
   faixa não aparece").
7. **Se houver decisão para ele,** a pergunta com as opções escritas. Ele lê
   pelo celular e responde com um toque.

## 8. Outra sessão mexendo na mesma pasta

Às vezes há duas sessões do Claude no mesmo repositório. Então:
- comite só os seus caminhos;
- confira se o que vai subir passa na checagem sozinho. Se a pasta estiver
  misturada, use uma cópia de rascunho (`git worktree`) no commit exato;
- avise o dono que havia trabalho de outra sessão na pasta e o que você fez
  para não misturar.

## 9. Modelos de mensagem

**Plano (mais de 3 arquivos):**

> Para fazer X, mexo em 5 arquivos:
> - `shared/x.ts` (novo): a regra de quando aparece, usada pela tela e pelo servidor;
> - `server/x.ts` (novo): …;
> - `server/rotas.ts`: uma rota nova, só do admin; as outras não mudam;
> - `client/.../Tela.tsx`: …;
> - `tests/x.test.ts` (novo): ….
>
> Não encosta em banco, dinheiro nem prova. Não precisa de db:push.

**Fechamento:**

> A tela X está na main, commit `abc1234`. A checagem passou (tipos, os 2.128
> testes e o build) e o servidor sobe sem erro. Falta o seu Pull e Republish,
> sem db:push. Ainda não vi a resposta de verdade da IA: precisa da chave, que
> só está no Replit. Se der errado, é só reverter o `abc1234`.
>
> **Arquivos:** (um por linha, com o porquê)
>
> **Roteiro de teste:**
> 1. No Replit, faça o Pull e o Republish.
> 2. Abra … e confira …
> 3. …

**Commit:**

```
Área: o que mudou, em uma linha

Por que (o pedido, a prévia aprovada, o problema que resolve).
- detalhe que importa para quem ler o histórico depois
- o que NÃO mudou, quando isso tranquiliza (as outras rotas, o banco)

Co-Authored-By: ...
```
