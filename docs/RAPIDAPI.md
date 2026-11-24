# Primeira versão no RapidAPI

## Pacote preparado

Use [rapidapi.openapi.json](../rapidapi.openapi.json) para importar a definição do **piloto de consultas**. Ele contém nove operações GET: saúde do serviço, fontes, lista/detalhe de estabelecimentos, Autismo e apoio, reabilitação, orientações de acesso, operadoras ANS e características cadastrais nacionais de planos. Não inclui rotas administrativas. Adicionar planos à listagem depois de validar a carga remota completa.

A definição canônica [openapi.json](../openapi.json) continua com nove operações para compatibilidade da API existente. Para atualizar o pacote após mudanças na definição canônica:

```sh
python3 scripts/prepare_rapidapi.py --output rapidapi.openapi.json
```

O gerador conserva somente consultas e os componentes referenciados, sem alterar o contrato da API principal. O teste Python detecta pacote desatualizado. Não publica nada automaticamente.

## Texto inicial para o cadastro

**Nome:** Rede Girassol API

**Descrição curta:** Consulta a dados públicos de estabelecimentos de saúde, reabilitação e apoio a pessoas autistas, com fontes, datas e contatos institucionais publicados.

**Descrição detalhada:** Projeto independente em desenvolvimento. Organiza cadastros CNES importados e limitados, observações mensais de reabilitação e curadoria documental de atendimento a TEA. A cobertura inicial é parcial, com dados de Curitiba/PR. Contatos publicados não comprovam linha ativa ou agendamento. Atendimento documentado não significa vaga disponível ou cobertura por plano. Reabilitação intelectual não confirma, sozinha, atendimento a pessoas autistas. O módulo Encontre apoio oferece resumos revisados, sem geração por IA. Operadoras ANS têm primeira carga confirmada; o catálogo nacional de características dos planos depende da carga completa validada. Rede credenciada não integrada.

**Origem técnica atual:** `https://rede-girassol-api-v-1.rafael10mayer.workers.dev`

Não anunciar cobertura nacional, busca semântica, diagnóstico, vagas ou rede credenciada confirmada. Não incluir credenciais administrativas na definição, exemplos ou descrição pública.

## Configuração no navegador

1. Entrar no RapidAPI Studio e criar uma API inicialmente privada/rascunho.
2. Importar o arquivo `rapidapi.openapi.json` (baixar o arquivo bruto do GitHub após merge) e conferir as nove operações.
3. Conferir o endereço de origem nas configurações do gateway; os caminhos devem ser preservados.
4. Testar `/health`, `/v1/places?state=PR&city=Curitiba&limit=2`, `/v1/autism-support?city=Curitiba`, `/v1/rehabilitation?reference_month=202607&limit=2` e `/v1/support-guide` pelo playground. Comparar corpo e status com a documentação; os totais dependem das cargas e dos prazos de revisão.
5. Definir modalidade de acesso e limites no RapidAPI antes de tornar a listagem pública. O responsável confirmou o plano Basic gratuito: US$ 0/mês, 1.000 consultas/mês com Hard Limit e 10 consultas/minuto. Conferir separadamente a taxa de banda da plataforma, que não é receita da Girassol.

Os nomes das opções podem variar na interface. A listagem existente foi criada e testada pelo responsável; o último estado confirmado é privado. Esta alteração no repositório não importa definições nem publica na conta.

## Acesso separado com Proxy Secret

O Worker oferece as nove consultas do piloto também sob `/rapidapi`, exigindo o cabeçalho que o próprio gateway adiciona. As rotas públicas antigas e o painel continuam acessíveis. O namespace não expõe importação, administração ou documentação.

Após merge/deploy:

1. Em RapidAPI → Hub Listing → Gateway → Firewall Settings, copiar **X-RapidAPI-Proxy-Secret**, mantendo o valor oculto.
2. Em Cloudflare → Worker rede-girassol-api-v-1 → Configurações → Variáveis e segredos, adicionar tipo **Secret**, nome `RAPIDAPI_PROXY_SECRET`, valor copiado. Salvar/implantar. Não usar `IMPORT_TOKEN` nem a chave do consumidor.
3. Em RapidAPI → Hub Listing → General → Base URL, substituir pela origem com prefixo:

   `https://rede-girassol-api-v-1.rafael10mayer.workers.dev/rapidapi`

4. Manter os caminhos dos endpoints como `/health`, `/sources`, `/v1/...`; não duplicar o prefixo. A definição atualizada já aponta para essa Base URL para novas importações; no projeto existente basta mudar a Base URL, sem recriar endpoints.
5. Repetir `/health` e uma consulta paginada pelo RapidAPI: devem retornar 200. Abrir `/rapidapi/health` diretamente sem cabeçalho deve retornar 403; sem segredo configurado, 503. Caminhos/métodos não permitidos retornam 404/405. A raiz pública e o painel continuam funcionais.

O valor secreto não deve ir ao chat, repositório, exemplos ou screenshots. O cabeçalho é acrescentado pelo gateway; o consumidor usa suas próprias credenciais RapidAPI. [Referência oficial](https://docs.rapidapi.com/docs/hub-listing-gateway-tab).

**Limitação:** isso autentica o namespace de integração, mas não elimina as consultas diretas à API pública que sustenta o painel. Cotas do RapidAPI não são cotas globais da infraestrutura. O Worker não ganhou rate limiting por consumidor; não anunciar acesso exclusivo ou bloqueio de bypass para dados também públicos.

## Definir limites na conta

Em **Monetize**, o responsável confirmou Basic a **US$ 0/mês**, **1.000 chamadas/mês com Hard Limit** e **10 chamadas/minuto**. A tela também informa uma taxa de banda da plataforma após a franquia; isso é separado do preço da API. Conferir a condição atual na conta antes de publicar, sem anunciar ausência absoluta de qualquer taxa da plataforma. Nenhuma cobrança nova foi configurada por esta alteração.

A [documentação de rate limiting](https://docs.rapidapi.com/v2.0/docs/rate-limiting) descreve configuração por plano e observa que o proprietário pode ter uma assinatura de teste ilimitada. Os testes feitos com a conta proprietária validam respostas, não demonstram bloqueio das cotas de consumidor. Não escolher plano cobrado ou cobrança por excedente sem decisão explícita do responsável.

## Fontes e reutilização: conferência antes da publicação

- [Portal CNES](https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude).
- [Serviços especializados CNES](https://dadosabertos.saude.gov.br/dataset/cnes_servicos_especializados).
- [Orientação de dados abertos do Ministério da Saúde](https://www.gov.br/saude/pt-br/acesso-a-informacao/dados-abertos/dados-abertos).
- Curadoria municipal, resumos e contatos: fontes individuais nos guias [reabilitação](REHABILITATION.md), [orientações](SUPPORT_GUIDE.md) e [contatos](CONTACTS.md).

A revisão inicial encontrou avisos de licença no portal e orientação geral sobre dados abertos; isso não foi tratado como comprovação de licença específica para cada recurso ou como autorização para qualquer uso comercial. Conferir e registrar a licença/condições de cada conjunto efetivamente distribuído, manter atribuição e links e não redistribuir imagens, marcas ou artigos integrais das instituições. A revisão em [SOURCE_REUSE_REVIEW.md](SOURCE_REUSE_REVIEW.md) registra o aviso CC BY-ND 3.0, o texto federal aplicável, o alcance limitado desses achados e uma mensagem pronta para esclarecer a dúvida documental. Não declara autorização específica que não foi obtida.

## Sequência para a ANS

A primeira carga de operadoras e a repetição foram confirmadas em produção em 24/11/2026. O catálogo nacional de planos tem [workflow próprio de envio em partes](ANS_PLANS.md), ainda pendente de primeira carga remota. Só mostrar telas quando os respectivos dados estiverem completos. Nenhum desses cadastros comprova vínculo com rede credenciada.

## Adicionar operadoras após a carga validada

A definição atualizada inclui `/v1/operators` e seus filtros (nove consultas no pacote preparado, incluindo planos). Ela não foi reimportada na conta RapidAPI por esta alteração. A carga de operadoras já foi confirmada; adicionar/importar a operação na listagem, preservando Base URL com `/rapidapi`, Proxy Secret e plano já configurados. A importação no marketplace e a visibilidade continuam ações separadas. O menu de planos só aparece após a carga nacional completa.

## Pendências para concluir a listagem existente

1. Adicionar/conferir a operação `/v1/operators`, ainda sem importação confirmada na conta. Após validar a carga nacional, adicionar `/v1/plans` com os filtros da definição preparada de nove consultas.
2. Manter Base URL com `/rapidapi`, Proxy Secret e o plano gratuito já conferidos; testar as novas operações no playground.
3. Atualizar descrições: CNES/curadoria parcial em Curitiba; características cadastrais nacionais de operadoras/planos conforme cargas; sem rede credenciada ou vagas confirmadas.
4. Concluir a conferência documental já registrada em [SOURCE_REUSE_REVIEW.md](SOURCE_REUSE_REVIEW.md), com atribuições e condições efetivamente aplicáveis. Não declarar resposta/autorização específica ainda não obtida.
5. O responsável confirma a declaração de direitos/termos e muda a visibilidade de privada para pública quando concluir a revisão. Teste com conta proprietária não demonstra acesso público nem aplicação das cotas a consumidores.

O status público e a primeira carga nacional de planos precisam ser confirmados; o repositório não altera a conta RapidAPI automaticamente.
