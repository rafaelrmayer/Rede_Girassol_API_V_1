# Primeira versão no RapidAPI

## Pacote preparado

Use [rapidapi.openapi.json](../rapidapi.openapi.json) para importar a definição do **piloto de consultas**. Ele contém sete operações GET: saúde do serviço, fontes, lista/detalhe de estabelecimentos, Autismo e apoio, reabilitação e orientações de acesso. Não inclui rotas administrativas nem as duas consultas ANS ainda sem carga.

A definição canônica [openapi.json](../openapi.json) continua com nove operações para compatibilidade da API existente. Para atualizar o pacote após mudanças na definição canônica:

```sh
python3 scripts/prepare_rapidapi.py --output rapidapi.openapi.json
```

O gerador remove as rotas pendentes e os componentes que deixam de ser referenciados, sem alterar o contrato da API principal. O teste Python detecta pacote desatualizado. Não publica nada automaticamente.

## Texto inicial para o cadastro

**Nome:** Rede Girassol API

**Descrição curta:** Consulta a dados públicos de estabelecimentos de saúde, reabilitação e apoio a pessoas autistas, com fontes, datas e contatos institucionais publicados.

**Descrição detalhada:** Projeto independente em desenvolvimento. Organiza cadastros CNES importados e limitados, observações mensais de reabilitação e curadoria documental de atendimento a TEA. A cobertura inicial é parcial, com dados de Curitiba/PR. Contatos publicados não comprovam linha ativa ou agendamento. Atendimento documentado não significa vaga disponível ou cobertura por plano. Reabilitação intelectual não confirma, sozinha, atendimento a pessoas autistas. O módulo Encontre apoio oferece resumos revisados, sem geração por IA. Operadoras, produtos ANS e rede credenciada não integram este piloto.

**Origem técnica atual:** `https://rede-girassol-api-v-1.rafael10mayer.workers.dev`

Não anunciar cobertura nacional, busca semântica, diagnóstico, vagas ou rede credenciada confirmada. Não incluir credenciais administrativas na definição, exemplos ou descrição pública.

## Configuração no navegador

1. Entrar no RapidAPI Studio e criar uma API inicialmente privada/rascunho.
2. Importar o arquivo `rapidapi.openapi.json` (baixar o arquivo bruto do GitHub após merge) e conferir as sete operações.
3. Conferir o endereço de origem nas configurações do gateway; os caminhos devem ser preservados.
4. Testar `/health`, `/v1/places?state=PR&city=Curitiba&limit=2`, `/v1/autism-support?city=Curitiba`, `/v1/rehabilitation?reference_month=202607&limit=2` e `/v1/support-guide` pelo playground. Comparar corpo e status com a documentação; os totais dependem das cargas e dos prazos de revisão.
5. Definir modalidade de acesso e limites no RapidAPI antes de tornar a listagem pública. Não há plano pago, preço ou cota escolhidos por este pacote.

Os nomes das opções podem variar na interface. Nenhuma conta RapidAPI foi acessada e nenhuma listagem foi criada ou publicada por esta alteração.

## Acesso separado com Proxy Secret

O Worker oferece as sete consultas do piloto também sob `/rapidapi`, exigindo o cabeçalho que o próprio gateway adiciona. As rotas públicas antigas e o painel continuam acessíveis. O namespace não expõe importação, administração, documentação ou rotas ANS.

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

Em **Monetize**, conferir o plano e as opções que a conta oferece. Proposta inicial para avaliação: acesso gratuito, sem excedentes pagos, teto de 1.000 chamadas/mês e 10 chamadas/minuto, se a interface permitir. São valores sugeridos, ainda não configurados ou escolhidos pelo responsável. Confirmar unidade, teto efetivo e tratamento de excedentes antes de salvar.

A [documentação de rate limiting](https://docs.rapidapi.com/v2.0/docs/rate-limiting) descreve configuração por plano e observa que o proprietário pode ter uma assinatura de teste ilimitada. Os testes feitos com a conta proprietária validam respostas, não demonstram bloqueio das cotas de consumidor. Não escolher plano cobrado ou cobrança por excedente sem decisão explícita do responsável.

## Fontes e reutilização: conferência antes da publicação

- [Portal CNES](https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude).
- [Serviços especializados CNES](https://dadosabertos.saude.gov.br/dataset/cnes_servicos_especializados).
- [Orientação de dados abertos do Ministério da Saúde](https://www.gov.br/saude/pt-br/acesso-a-informacao/dados-abertos/dados-abertos).
- Curadoria municipal, resumos e contatos: fontes individuais nos guias [reabilitação](REHABILITATION.md), [orientações](SUPPORT_GUIDE.md) e [contatos](CONTACTS.md).

A revisão inicial encontrou avisos de licença no portal e orientação geral sobre dados abertos; isso não foi tratado como comprovação de licença específica para cada recurso ou como autorização para qualquer uso comercial. Conferir e registrar a licença/condições de cada conjunto efetivamente distribuído, manter atribuição e links e não redistribuir imagens, marcas ou artigos integrais das instituições. A revisão em [SOURCE_REUSE_REVIEW.md](SOURCE_REUSE_REVIEW.md) registra o aviso CC BY-ND 3.0, o texto federal aplicável, o alcance limitado desses achados e uma mensagem pronta para esclarecer a dúvida documental. Não declara autorização específica que não foi obtida.

## Sequência para a ANS

Após o piloto: verificar arquivos/dicionários e licença oficiais de operadoras; implementar preparação, importação idempotente, fonte/data e testes; validar os registros em produção. Em seguida fazer o mesmo para produtos/planos e seus vínculos com operadoras. Só reativar as telas quando houver dados reais consultáveis e informação útil. Cadastro de estabelecimento, operadora ou produto não basta para afirmar vínculo de rede credenciada: esse relacionamento exige uma fonte adicional específica.
