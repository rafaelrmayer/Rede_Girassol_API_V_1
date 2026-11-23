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

## Acesso e limites: pendência técnica explícita

A origem atual é pública e continua atendendo o painel e a documentação. As cotas configuradas no RapidAPI controlam chamadas que passam pelo gateway; **não bloqueiam acesso direto à origem**. Este pacote não implementa autenticação de consumidores ou rate limiting no Worker.

A [documentação oficial do gateway RapidAPI](https://docs.rapidapi.com/docs/hub-listing-gateway-tab) descreve o cabeçalho `X-RapidAPI-Proxy-Secret`, que permite ao backend conferir chamadas encaminhadas pelo gateway. Quando o rascunho existir, preparar e testar um acesso de integração protegido com esse segredo, preservando o painel público. O segredo fica somente na configuração do backend; não deve ser compartilhado no chat, commitado ou confundido com a chave do consumidor `X-RapidAPI-Key`.

Antes de oferecer cotas exclusivas ou cobrar por acesso, é necessário concluir essa decisão de arquitetura e validar os limites reais. Não apresentar o pacote como integração de cobrança pronta. O próximo passo concreto é criar o rascunho e conferir as configurações que a conta disponibiliza.

## Fontes e reutilização: conferência antes da publicação

- [Portal CNES](https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude).
- [Serviços especializados CNES](https://dadosabertos.saude.gov.br/dataset/cnes_servicos_especializados).
- [Orientação de dados abertos do Ministério da Saúde](https://www.gov.br/saude/pt-br/acesso-a-informacao/dados-abertos/dados-abertos).
- Curadoria municipal, resumos e contatos: fontes individuais nos guias [reabilitação](REHABILITATION.md), [orientações](SUPPORT_GUIDE.md) e [contatos](CONTACTS.md).

A revisão inicial encontrou avisos de licença no portal e orientação geral sobre dados abertos; isso não foi tratado como comprovação de licença específica para cada recurso ou como autorização para qualquer uso comercial. Conferir e registrar a licença/condições de cada conjunto efetivamente distribuído, manter atribuição e links e não redistribuir imagens, marcas ou artigos integrais das instituições. A documentação atual registra essa pendência, sem declarar que a conferência de reutilização está concluída.

## Sequência para a ANS

Após o piloto: verificar arquivos/dicionários e licença oficiais de operadoras; implementar preparação, importação idempotente, fonte/data e testes; validar os registros em produção. Em seguida fazer o mesmo para produtos/planos e seus vínculos com operadoras. Só reativar as telas quando houver dados reais consultáveis e informação útil. Cadastro de estabelecimento, operadora ou produto não basta para afirmar vínculo de rede credenciada: esse relacionamento exige uma fonte adicional específica.
