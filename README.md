# 🌻 Rede Girassol API

Projeto desenvolvido por **[Rafael Ricardo Mayer](https://github.com/rafaelrmayer)** para organizar informações públicas de saúde em uma API documentada, com integração planejada de fontes oficiais do CNES e da ANS.

**API de dados de saúde com integração planejada de fontes oficiais do CNES e da ANS, transparência e rastreabilidade das informações.**

A **Rede Girassol API** é um projeto independente de tecnologia para organizar e disponibilizar informações públicas sobre estabelecimentos de saúde e, conforme a disponibilidade e a validação das fontes, operadoras e produtos da saúde suplementar brasileira.

O objetivo é facilitar a descoberta de informações úteis por meio de uma API documentada, com atenção à origem, à atualização e aos limites de cada conjunto de dados.

> **Tecnologia, informação e cuidado.**  
> *Rumo à utopia e ao horizonte.* 🌻

## Sobre o projeto

A Rede Girassol API está em fase inicial de desenvolvimento. A estrutura foi preparada para receber dados normalizados de fontes oficiais, expor endpoints de consulta e registrar importações. A integração completa com os arquivos reais do CNES e da ANS ainda precisa ser implementada e validada.

### Objetivos

- Pesquisar estabelecimentos de saúde.
- Consultar detalhes cadastrais de estabelecimentos.
- Organizar informações disponíveis sobre operadoras e produtos de saúde suplementar.
- Manter rastreabilidade da origem e da data de importação.
- Diferenciar dados confirmados, não verificados e desatualizados.
- Oferecer uma base para futuras aplicações web e móveis.

## Fontes oficiais de dados

- **CNES — Cadastro Nacional de Estabelecimentos de Saúde:** [Dados abertos do CNES](https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude)
- **ANS — Agência Nacional de Saúde Suplementar:** [Dados e indicadores do setor](https://www.gov.br/ans/pt-br/acesso-a-informacao/perfil-do-setor/dados-e-indicadores-do-setor)
- **ANS — Dados abertos:** [Portal de dados abertos da ANS](https://www.gov.br/ans/pt-br/acesso-a-informacao/perfil-do-setor/dados-abertos-1)

**Limite importante:** um estabelecimento cadastrado no CNES não está, por isso, automaticamente confirmado como prestador de um plano específico. A associação entre estabelecimento, operadora e produto só deve ser exibida como confirmada quando houver uma fonte adequada e uma regra de validação documentada. Os dados precisam ser avaliados quanto à data de referência, licença, cobertura e atualização.

## Tecnologias

- **TypeScript** — implementação da API.
- **Cloudflare Workers** — execução da API.
- **Cloudflare D1** — banco de dados SQL.
- **Vitest** — testes automatizados.
- **Python** — script auxiliar para envio de registros normalizados.
- **GitHub Codespaces** — ambiente de desenvolvimento no navegador.

## Arquitetura inicial

O fluxo proposto parte das fontes oficiais CNES e ANS, passa pela inspeção e normalização dos registros e por uma importação controlada. A API em Cloudflare Workers consulta os dados armazenados no Cloudflare D1 e os disponibiliza às aplicações.

Essa é uma arquitetura inicial. Os formatos brutos dos arquivos oficiais ainda precisam ser inspecionados e mapeados antes de uma importação real confiável.

## Estrutura do repositório

```text
rede-girassol-api/
├── migrations/
│   └── 0001_initial.sql
├── src/
│   └── index.ts
├── tests/
│   └── index.test.ts
├── scripts/
│   └── import_records.py
├── fixtures/
│   ├── cnes_sample.json
│   └── ans_operators_sample.json
├── .dev.vars.example
├── .gitignore
├── LICENSE
├── package.json
├── README.md
├── tsconfig.json
├── vitest.config.ts
└── wrangler.toml
```

## Endpoints previstos na V0.1

| Método | Endpoint | Objetivo |
|---|---|---|
| `GET` | `/health` | Verificar se a API responde. |
| `GET` | `/sources` | Consultar as fontes documentadas. |
| `GET` | `/v1/places` | Pesquisar estabelecimentos cadastrados na base. |
| `GET` | `/v1/places/{id}` | Consultar um estabelecimento pelo identificador. |
| `GET` | `/v1/operators` | Pesquisar operadoras cadastradas na base. |
| `GET` | `/v1/plans` | Consultar produtos cadastrados na base. |
| `POST` | `/admin/import` | Enviar registros normalizados para importação autorizada. |
| `GET` | `/admin/imports` | Consultar o histórico de importações. |

Os endpoints administrativos exigem token. Consulte `src/index.ts` e `wrangler.toml` para verificar a implementação e a configuração atuais. Não coloque segredos no código nem os envie ao GitHub.

## Painel web V0.1

A primeira interface visual é servida pelo próprio Cloudflare Worker:

| Método | Endpoint | Objetivo |
|---|---|---|
| `GET` | `/` | Abrir o painel Rede Girassol. |
| `GET` | `/dashboard` | Abrir o painel pela rota alternativa. |

O painel consulta somente os endpoints da API (`/health`, `/sources`, `/v1/places`, `/v1/operators` e `/v1/plans`). Não importa nem lê os arquivos de demonstração em `fixtures/`.

As telas exibem os registros realmente retornados pelo banco conectado à API. Quando não houver resultados, a interface informa a ausência de registros; em caso de falha, informa que a consulta não pôde ser concluída. As listas respeitam o limite atual de até 100 registros por endpoint e não representam necessariamente o total armazenado.

**Importante:** esta interface é uma entrega de desenvolvimento. A integração real, o mapeamento e a validação das fontes CNES e ANS continuam pendentes. A interface não deve ser implantada em produção antes da revisão técnica, execução dos testes e validação do ambiente.

## Começar no GitHub Codespaces

É possível desenvolver pelo navegador sem instalar ferramentas no computador institucional, desde que o Codespace disponibilize Node.js e npm.

```bash
npm install
npm test
```

Para configurar e executar localmente no Codespaces, siga os comandos e requisitos de `package.json` e `wrangler.toml`. A implantação no Cloudflare exige configurar os recursos D1 e os segredos de ambiente adequados.

### Importação de dados

O script `scripts/import_records.py` foi pensado para enviar registros **já normalizados** para a API. Ele não baixa automaticamente nem transforma por conta própria os arquivos brutos do CNES ou da ANS. Antes de usar dados oficiais, será necessário:

1. Baixar os arquivos a partir da fonte oficial.
2. Inspecionar o formato, os campos e a data de referência.
3. Mapear os campos para o esquema interno.
4. Validar amostras e regras de qualidade.
5. Fazer uma importação de teste e conferir os resultados.
6. Documentar fonte, licença e data da carga.

Os arquivos em `fixtures/` são exemplos fictícios para desenvolvimento, não registros oficiais.

## Qualidade, privacidade e transparência

- Registrar origem e data de importação dos dados.
- Evitar afirmar que uma informação está confirmada quando não houver evidência suficiente.
- Documentar dados ausentes, desatualizados ou não verificados.
- Proteger rotas administrativas e credenciais.
- Respeitar os termos de uso e as licenças das fontes.
- Considerar a LGPD sempre que houver tratamento de dados pessoais.
- Testar antes de publicar.

A API é um projeto experimental e não substitui a confirmação diretamente com o estabelecimento, a operadora ou os canais oficiais.

## Estado do projeto

**Versão:** estrutura inicial V0.1 — em desenvolvimento.

A estrutura de código, o esquema inicial de dados, os endpoints e os testes foram preparados. Os testes devem ser executados no ambiente de desenvolvimento antes de considerar a versão validada. A integração e a validação dos arquivos oficiais do CNES e da ANS ainda são etapas de trabalho.

## Autor e portfólio

**Rafael Ricardo Mayer**  
Pesquisador independente e desenvolvedor de projetos em inteligência artificial, tecnologia assistiva, acessibilidade e soluções digitais.

- GitHub: [@rafaelrmayer](https://github.com/rafaelrmayer)
- Instagram: [@rafael_rmayer](https://www.instagram.com/rafael_rmayer/)

Conheça outros projetos no [perfil do GitHub](https://github.com/rafaelrmayer).

## Licença

Consulte o arquivo [`LICENSE`](LICENSE) para as condições de uso do código. As condições de reutilização de dados de terceiros devem ser verificadas separadamente.

---

**Rede Girassol API** — tecnologia, informação e cuidado.  
**Rafael Ricardo Mayer** · [GitHub](https://github.com/rafaelrmayer) · [Instagram](https://www.instagram.com/rafael_rmayer/)

## Outros projetos de Rafael Ricardo Mayer

- **[Jornada de Bia](https://github.com/rafaelrmayer/jornada-de-Bia_Sakura_V.1.5)**: Comunicação aumentativa e alternativa (CAA) e tecnologia assistiva.
- **[Prospecta](https://github.com/rafaelrmayer/Prospecta_V1)**: Protótipo de prospecção comercial local.
- **[INK Bia Cerisier](https://github.com/rafaelrmayer/ink-bia-cerisier)**: Projeto de plataforma de gestão para tatuadores e estúdios.

## Importação funcional de estabelecimentos normalizados

Esta entrega grava estabelecimentos no D1 e permite consultá-los no painel. A importação de operadoras/produtos ANS e a transformação dos arquivos oficiais continuam pendentes. `source` identifica a origem **declarada pelo importador**, sem atestar autenticidade.

Use Node.js 22.13 ou superior (recomendado: Node.js 24). O lockfile fixa as dependências para instalações reproduzíveis:

```bash
npm ci
npm test
npm run typecheck
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply rede-girassol-db --local
npm run dev
```

Troque o token de exemplo em `.dev.vars` por um valor local. Para enviar o exemplo fictício, configure `IMPORT_TOKEN` no ambiente do terminal com o mesmo valor e execute:

```bash
python3 scripts/import_records.py --file fixtures/cnes_sample.json --source sample
```

O script lê `IMPORT_TOKEN` do ambiente; não coloque credenciais em comandos compartilhados ou commits. `.dev.vars` e arquivos locais de ambiente são ignorados pelo Git. O banco local é separado do D1 remoto; esses comandos não publicam o Worker.

Contrato de `POST /admin/import` (Bearer administrativo obrigatório):

```json
{
  "entity": "establishments",
  "source": "manual",
  "records": [{
    "cnes_code": "0000001",
    "name": "Unidade fictícia",
    "city": "Curitiba",
    "state": "PR",
    "address": null,
    "source_updated_at": "2026-11-23"
  }]
}
```

- `entity` pode ser omitido por compatibilidade; quando informado, deve ser `establishments`.
- Origens aceitas: `cnes`, `manual` e `sample`. O exemplo em `fixtures/` deve usar `sample`. ANS é recusada nesta etapa.
- CNES obrigatório como texto de sete números, preservando zeros iniciais; nome obrigatório, até 300 caracteres. Município até 150, endereço até 500, UF brasileira válida e data real no formato `AAAA-MM-DD`. Campos opcionais ausentes ou `null` ficam vazios.
- `id` legado é aceito, mas a identidade é determinada pelo CNES: novos registros recebem `cnes-{código}` e atualizações preservam o ID existente. O campo `source` dentro de um registro, quando presente, deve coincidir com o lote.
- De 1 a 100 registros, corpo até 256 KiB. Campos desconhecidos, CNES repetido no lote e dados inválidos são recusados com `422`; JSON inválido retorna `400`; limites excedidos retornam `413`.
- Todos os registros são validados antes da gravação. O lote e seu histórico são gravados em uma única transação D1. Falha na gravação retorna `500` e desfaz o lote inteiro.
- Sucesso retorna `200`, `status: completed`, `import_id` e contagens. `records_imported` conta registros processados (inseridos ou atualizados), e não somente novos cadastros. Reenviar o mesmo CNES atualiza os campos sem duplicar o estabelecimento; campos opcionais omitidos também são apagados. Cada envio bem-sucedido gera uma entrada no histórico.

Confira `GET /v1/places?city=Curitiba&state=PR`, `GET /v1/places/0000001` e `GET /admin/imports`. Nenhuma associação a planos é criada pela importação. A existência no CNES continua sem comprovar rede credenciada.

Os testes usam a migração real e SQLite em memória para validar persistência, consultas, atualização, validação, autorização e rollback. A checagem TypeScript ignora declarações de bibliotecas externas (`skipLibCheck`) porque Vitest/Node e Workers declaram globais sobrepostos; o código do projeto permanece com verificação estrita.

## Primeira amostra real do CNES

O preparador `scripts/prepare_cnes_sample.py` consulta uma única página de até 20 estabelecimentos na [API oficial do Ministério da Saúde](https://apidadosabertos.saude.gov.br/v1). O formato mapeado é **`GET /cnes/estabelecimentos`**, com envelope `estabelecimentos`; não se trata de um conversor genérico para todos os arquivos ZIP ou para a rota distinta `/assistencia-a-saude/cnes-estabelecimentos`.

Foi conferida uma amostra de três estabelecimentos de Curitiba em 23/11/2026. Os campos da API não incluem o nome do município: a conversão cruza `codigo_municipio` de seis dígitos com os primeiros seis dígitos do ID municipal de sete dígitos da [API de localidades do IBGE](https://servicodados.ibge.gov.br/api/docs/localidades). A UF também precisa corresponder. Falta de correspondência interrompe a preparação.

| Campo oficial CNES | Campo interno / regra |
|---|---|
| `codigo_cnes` | `cnes_code`: texto de sete dígitos, recuperando zeros iniciais |
| `nome_fantasia` | `name`; na ausência, usa `nome_razao_social` |
| `codigo_uf` | `state`: sigla correspondente ao código IBGE |
| `codigo_municipio` | `city`: nome verificado na lista de municípios do IBGE |
| `endereco_estabelecimento`, `numero_estabelecimento`, `bairro_estabelecimento` | `address`: partes presentes separadas por vírgula |
| `data_atualizacao` | `source_updated_at`: data real do cadastro; ausência vira `null` |

Demais campos da resposta, incluindo e-mail, telefone, CNPJ e coordenadas, não são copiados. O campo `source` recebe `cnes`. A data de download não substitui a data de atualização do cadastro.

### 1. Preparar e conferir (sem token ou conta Cloudflare)

```bash
python3 scripts/prepare_cnes_sample.py \
  --state-code 41 --municipality 410690 --limit 3 \
  --output data/cnes-curitiba.json
```

O comando usa filtros de UF, município e `status=1` (ativo) na API oficial. Confere o município e o limite devolvidos, gera o JSON normalizado e `data/cnes-curitiba.json.metadata.json` com URLs consultadas, horário UTC e hashes dos JSONs canônicos recebido e gerado. Não faz importação, não configura Cloudflare e não altera banco algum. Arquivos existentes não são sobrescritos. A pasta `data/` é ignorada pelo Git.

Abra o arquivo e confira os três nomes, códigos CNES, endereço institucional e datas. Os metadados registram o filtro solicitado de situação ativa; o esquema interno atual não armazena a situação cadastral. Portanto, não há acompanhamento automático de desativação ou atualização posterior. A data do portal e a data de cada cadastro também podem diferir.

Para reproduzir a conversão sem rede, forneça uma resposta CNES salva e uma lista IBGE salva:

```bash
python3 scripts/prepare_cnes_sample.py \
  --input resposta-cnes.json --municipalities municipios-ibge.json \
  --output data/cnes-offline.json
```

O modo offline registra a origem como arquivos locais, sem afirmar que foram baixados ou autenticados pelo script. Hashes servem para comparar conteúdo, não para atestar autenticidade.

### 2. Importar somente no ambiente local

Com o D1 local migrado, o Worker rodando e `IMPORT_TOKEN` configurado conforme a seção anterior:

```bash
python3 scripts/import_records.py --file data/cnes-curitiba.json --source cnes
```

Confira `http://127.0.0.1:8787/v1/places?city=Curitiba&state=PR` e o painel na raiz. Reenviar o arquivo atualiza os mesmos CNES, sem duplicação. A publicação remota fica para uma etapa posterior, após conferir amostra, ambiente e condições de reutilização da fonte. Cadastro no CNES não comprova atendimento por um plano específico nem disponibilidade atual de serviços.

### Testar o mapeamento

```bash
npm run test:cnes
```

Os testes Python usam dados fictícios com os nomes de campos observados na API, sem depender de acesso à internet. Verificam zeros iniciais, UF/município, campos ausentes, datas, duplicação e preparação offline com metadados. As verificações do GitHub executam esses testes junto dos testes TypeScript.

## Preparar a amostra pelo navegador (sem Codespaces ou terminal)

Use a ação manual **Preparar amostra CNES** no GitHub:

1. Abra [Actions → Preparar amostra CNES](https://github.com/rafaelrmayer/Rede_Girassol_API_V_1/actions/workflows/cnes-sample.yml).
2. Clique em **Run workflow**, mantendo a branch `main`.
3. Para começar com Curitiba, mantenha **UF `41`**, **município `410690`** e **quantidade `3`**.
4. Clique no botão verde **Run workflow** e abra a execução criada.
5. Quando terminar verde, na página de resumo da execução, encontre **Artifacts** e baixe **cnes-amostra-…**.
6. Extraia o ZIP: `cnes-amostra.json` contém os estabelecimentos; `cnes-amostra.json.metadata.json` registra as fontes e os hashes.

O workflow aparece para execução manual depois que este arquivo estiver na branch principal. É necessário entrar no GitHub com permissão de escrita no repositório para dispará-lo. Se a execução ainda não aparecer na lista, atualize a página.

A ação roda os testes Python do conversor, consulta CNES e IBGE, valida e normaliza a amostra e disponibiliza os dois arquivos por **7 dias**. Os valores são validados pelo preparador: UF válida, município de seis dígitos correspondente à UF e quantidade de 1 a 20. Não exige tokens administrativos nem credenciais do Cloudflare. Não importa os dados em banco, não cria commits e não publica o Worker.

Se houver falha ou indisponibilidade da fonte oficial, a execução ficará vermelha; abra a etapa **Buscar e preparar amostra oficial** para conferir a mensagem. Corrija os filtros, se necessário, ou tente novamente mais tarde. Um arquivo só é publicado como artifact após a preparação bem-sucedida.
