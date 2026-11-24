# Consultar a Rede Girassol

- [Documentação interativa](https://rede-girassol-api-v-1.rafael10mayer.workers.dev/docs)
- [Definição OpenAPI JSON](https://rede-girassol-api-v-1.rafael10mayer.workers.dev/openapi.json)
- [Arquivo canônico no repositório](../openapi.json)

A documentação fica disponível após o deploy da versão que inclui essas rotas. A definição usa **OpenAPI 3.0.2** e descreve nove operações GET públicas. A página interativa carrega essa mesma definição, mostra os parâmetros e exemplos e executa consultas na origem em que foi aberta. Não depende de bibliotecas ou scripts externos para funcionar.

## Cobertura atual

A base contém somente os cadastros que já foram importados manualmente. A quantidade e os municípios disponíveis dependem das cargas realizadas. `/sources` indica a integração CNES como parcial e a ANS como pendente; não é uma medição da cobertura por município.

Cadastro no CNES não comprova vínculo com um plano de saúde, disponibilidade de serviços ou situação ativa atual. A data `source_updated_at` vem da fonte, quando informada. `imported_at`, disponível no detalhe, é o horário UTC de gravação no formato SQLite `AAAA-MM-DD HH:mm:ss`; não substitui a data de referência da fonte. Os exemplos de estabelecimentos no OpenAPI são fictícios e identificados como ilustrações de formato.

## Endereços e parâmetros

URL base: `https://rede-girassol-api-v-1.rafael10mayer.workers.dev`

| Consulta | Parâmetros |
|---|---|
| `GET /v1/support-guide` | Sem parâmetros; resumos documentais revisados do módulo Encontre apoio |
| `GET /health` | Disponibilidade do Worker; não consulta o D1 |
| `GET /sources` | Fontes documentadas e limites da integração |
| `GET /v1/places` | `q`, `city`, `state`, `limit`, `offset` |
| `GET /v1/places/{place_id}` | ID interno ou CNES de sete dígitos, preservando zeros iniciais |
| `GET /v1/autism-support` | `q`, `city`, `state`, `limit`, `offset`; fontes explícitas revisadas de atendimento a TEA |
| `GET /v1/rehabilitation` | `q`, `city`, `state`, `classification_code`, `reference_month` (AAAAMM), `cnes_code`, `service_type`, `limit`, `offset` |
| `GET /v1/operators` | `q`, `city`, `state`, `status`, `ans_code`, `limit`, `offset`; sede e situação conforme arquivos ANS importados |
| `GET /v1/plans` | `q`, `city`, `state`, `status`, `ans_code`, `limit`, `offset`; sede e situação conforme arquivos ANS importados |

`q` e `city` fazem pesquisa parcial com a semântica LIKE do SQLite, na qual `%` e `_` são curingas. `state` remove espaços externos e converte o valor para maiúsculas antes da comparação. Os limites de paginação são descritos na definição; formatos inválidos de UF ou filtros sem correspondência retornam lista vazia.

As consultas atuais no Worker são públicas, sem token. O catálogo OpenAPI contém somente operações de consulta. As rotas administrativas e seus segredos não fazem parte dessa definição.

## Paginação

`limit` aceita inteiros de 1 a 100, com padrão 100. `offset` conta **registros a pular**, começando em 0. O maior offset aceito é `9007199254740891`. Parâmetros repetidos, vazios, não inteiros ou fora dos limites são recusados.

```http
GET /v1/places?state=PR&city=Curitiba&limit=20&offset=0
Accept: application/json
```

- `results`: itens da página.
- `count`: quantidade de itens nesta página.
- `total`: quantidade correspondente aos filtros no banco atual.
- `pagination.next_offset`: offset da próxima página, ou `null` quando termina.
- `pagination.has_more`: indica se há mais resultados naquele momento.

Continue com os mesmos filtros e o `next_offset` retornado. Uma lista vazia é uma resposta válida. Uma consulta além da última página também retorna lista vazia, preservando `total`. Como cargas podem ocorrer entre requisições, os resultados de páginas diferentes não constituem um snapshot imutável.

## Respostas de erro

| HTTP | Significado |
|---|---|
| `400` | `invalid_pagination`: revise `limit` e `offset` |
| `404` | `not_found`: o ID ou CNES solicitado não está no banco |
| `403` | Bloqueio de acesso do Cloudflare antes do Worker; o formato pode ser definido pela plataforma |
| `500` | Falha de execução ou banco; o corpo pode ser gerado pela plataforma |

Clientes automáticos devem identificar o projeto no cabeçalho `User-Agent`, como fazem os scripts de importação. Esse cabeçalho não é uma credencial. A implementação atual do domínio rejeitou a identificação padrão `Python-urllib` com erro Cloudflare 1010.

## Preparar a importação no RapidAPI

1. Após o deploy, abra `/docs` e clique em **Baixar OpenAPI JSON**.
2. No cadastro da API no RapidAPI, escolha a opção de importar uma definição OpenAPI e envie o arquivo baixado.
3. Confira os seis métodos GET, a URL base, os parâmetros, exemplos e as descrições antes de disponibilizar o catálogo.
4. Mantenha `openapi.json` deste repositório como fonte da definição e use versões atualizadas do arquivo ao atualizar o catálogo.

O RapidAPI documenta [importação de definições OpenAPI](https://docs.rapidapi.com/v2/docs/add-an-api-basics) e [atualização do arquivo de definição](https://docs.rapidapi.com/v2.0/docs/updating-your-api). A configuração do marketplace, dos planos de uso e dos limites de acesso é uma etapa posterior; este documento não indica que a API já foi publicada lá.

## Validar mudanças

```bash
npm test
npm run typecheck
```

Os testes validam a estrutura OpenAPI, os exemplos e as respostas reais da implementação com SQLite, incluindo campos nulos, páginas vazias, parâmetros inválidos e estabelecimento ausente. A definição servida por `/openapi.json` deve ser idêntica ao arquivo canônico. A página `/docs` consulta somente a definição e as rotas GET.

## Autismo e reabilitação

Veja o [guia de fontes e importação](REHABILITATION.md). A busca dedicada a autismo usa curadoria institucional explícita, com público, publicação, revisão e prazo. `documented` significa que existe essa evidência, sem confirmação de vagas atuais. Ao vencer o prazo de revisão, o estabelecimento sai dessa busca até nova revisão. A lista não é exaustiva.

Reabilitação conserva observações mensais do serviço CNES 135. Sem `reference_month`, retorna a última competência importada por instituição, classificação e tipo; não equivale a um retrato completo do município. `autism_evidence` é `null` e `autism_care_verification` é `not_verified` quando não há curadoria válida. Classificação 002 não gera confirmação de TEA. Filtros repetidos ou classificação/mês/CNES inválidos retornam 400. Catálogo indisponível retorna 503 sem impedir as outras consultas.

## Encontre apoio

O [piloto de busca documental](SUPPORT_GUIDE.md) fornece resumos editoriais revisados em `GET /v1/support-guide`. Não recebe perguntas nem parâmetros; a interface pesquisa as palavras no navegador. Não usa geração por IA, não confirma vagas e retira resumos vencidos. A resposta inclui `mode`, `experimental`, `notice` e `documents` com fonte, datas, escopo e passos. Qualquer query string recebe 400. A rota funciona sem o banco.

## Contatos institucionais

As listas `/v1/places`, `/v1/autism-support`, `/v1/rehabilitation` e o detalhe de estabelecimento incluem `contact`, com telefones, e-mail/site quando conhecidos, origem, datas e limitações. `published` representa contato publicado conferido documentalmente; não confirma linha ativa ou agendamento. Sem fonte vigente, retorna `not_verified` e canais vazios. Veja o [guia de contatos](CONTACTS.md).

## Operadoras ANS

O [guia de carga ANS](ANS_OPERATORS.md) descreve os arquivos ativos/cancelados e a validação antes de publicar. A consulta conserva os campos existentes e acrescenta nome fantasia, modalidade, sede, datas de registro/cancelamento, motivo, fonte e snapshot quando disponíveis. `source_updated_at` é a data UTC do arquivo, não de edição individual. Ausência vira `not_in_latest_source`, não cancelamento inferido. Produtos/planos e rede credenciada continuam pendentes.
