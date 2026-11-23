# 🌻 Rede Girassol API

Projeto desenvolvido por **[Rafael Ricardo Mayer](https://github.com/rafaelrmayer)** para organizar informações públicas de saúde em uma API documentada, com integração planejada de fontes oficiais do CNES e da ANS.

**API de dados de saúde com integração planejada de fontes oficiais do CNES e da ANS, transparência e rastreabilidade das informações.**

A **Rede Girassol API** é um projeto independente de tecnologia para organizar e disponibilizar informações públicas sobre estabelecimentos de saúde e, conforme a disponibilidade e a validação das fontes, operadoras e produtos da saúde suplementar brasileira.

O objetivo é facilitar a descoberta de informações úteis por meio de uma API documentada, com atenção à origem, à atualização e aos limites de cada conjunto de dados.

> **Tecnologia, informação e cuidado.**  
> *Rumo à utopia e ao horizonte.* 🌻

## Documentação das consultas

Acesse a [documentação interativa](https://rede-girassol-api-v-1.rafael10mayer.workers.dev/docs), baixe o [OpenAPI JSON](https://rede-girassol-api-v-1.rafael10mayer.workers.dev/openapi.json) ou consulte o [guia da API](docs/API.md). O arquivo [openapi.json](openapi.json) descreve as consultas públicas para integração e futura importação no RapidAPI.

## Contatos institucionais

O painel e a API exibem telefones publicados, com botão para ligar, além de e-mail/site quando conferidos. Indicam central administrativa, procedência e data de revisão. Contato cadastrado no CNES é identificado separadamente; linha ativa e vagas precisam ser confirmadas. Veja o [guia dos contatos](docs/CONTACTS.md).

## Encontre apoio · Experimental

Perguntas prontas e busca local por palavras em orientações revisadas sobre acesso ao SUS, crianças/adolescentes, adultos e cuidadores. Mostra fontes e passos curtos, sem enviar o texto pesquisado ao servidor. É um piloto de recuperação documental, sem geração por IA. Veja o [guia do módulo](docs/SUPPORT_GUIDE.md).

## Autismo e apoio

O painel oferece uma busca própria para serviços com atendimento a pessoas autistas documentado em fontes oficiais revisadas, com público e orientação de acesso. Há também uma consulta independente de reabilitação CNES por modalidade e competência mensal. Cadastro de reabilitação intelectual não confirma, sozinho, atendimento a TEA. Consulte o [guia de configuração, fontes e importação](docs/REHABILITATION.md).

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

## Endpoints disponíveis na V0.1

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

As telas exibem os registros realmente retornados pelo banco conectado à API. Quando não houver resultados, a interface informa a ausência de registros; em caso de falha, informa que a consulta não pôde ser concluída. As listas têm páginas de até 100 registros na API e 20 no painel. O campo `total` informa quantos registros correspondem aos filtros; a visão geral mostra os totais importados, sem afirmar cobertura nacional.

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

O preparador `scripts/prepare_cnes_sample.py` consulta de uma a cinco páginas de até 20 estabelecimentos cada (máximo de 100 por execução) na [API oficial do Ministério da Saúde](https://apidadosabertos.saude.gov.br/v1). O formato mapeado é **`GET /cnes/estabelecimentos`**, com envelope `estabelecimentos`; não se trata de um conversor genérico para todos os arquivos ZIP ou para a rota distinta `/assistencia-a-saude/cnes-estabelecimentos`.

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

A ação roda os testes Python do conversor, consulta CNES e IBGE, valida e normaliza a amostra e disponibiliza os dois arquivos por **7 dias**. Os valores são validados pelo preparador: UF válida, município de seis dígitos correspondente à UF de 1 a 20 registros por página, de 1 a 5 páginas e página inicial entre 0 e 10000. Não exige tokens administrativos nem credenciais do Cloudflare. Não importa os dados em banco, não cria commits e não publica o Worker.

Se houver falha ou indisponibilidade da fonte oficial, a execução ficará vermelha; abra a etapa **Buscar e preparar amostra oficial** para conferir a mensagem. Corrija os filtros, se necessário, ou tente novamente mais tarde. Um arquivo só é publicado como artifact após a preparação bem-sucedida.

## Primeira implantação pelo painel Cloudflare

O Worker usa o nome `rede-girassol-api-v-1` e o binding D1 `DB`, conforme `wrangler.toml`. O identificador do banco é uma referência de configuração, não uma senha. Para usar outra conta ou banco, substitua esse identificador pelo do D1 correspondente antes de implantar.

Após criar `rede-girassol-db` e executar a migração `migrations/0001_initial.sql` no console do D1:

1. Abra **Workers e Pages → Criar aplicativo** e conecte o repositório do GitHub na branch `main`.
2. Use **nome do projeto `rede-girassol-api-v-1`**, igual ao nome no `wrangler.toml`.
3. No comando de build, informe `npm run typecheck`. O ambiente de build deve instalar as dependências do projeto com Node.js compatível (recomendado: 24).
4. No comando de implantação, informe `npx wrangler deploy`.
5. Confirme a implantação depois que a configuração do D1 estiver na branch `main`.
6. Ao concluir, abra a URL `workers.dev` exibida pelo Cloudflare e confira `/health` e `/v1/places`.

O primeiro painel pode estar vazio: gerar e baixar o artifact CNES não importa os registros no D1 remoto. As rotas administrativas ficam bloqueadas enquanto `IMPORT_TOKEN` não estiver configurado como segredo no Worker. Esse token não deve ser colocado no repositório nem enviado no chat. A implantação aplica o binding do banco, mas não executa migrações automaticamente.

## Importar a amostra no banco remoto pelo GitHub Actions

A ação manual **Importar amostra CNES na API** prepara uma **nova carga limitada** na fonte oficial durante a execução e grava os registros na API `https://rede-girassol-api-v-1.rafael10mayer.workers.dev`. Ela não usa o ZIP baixado anteriormente. O arquivo enviado, os metadados e um comprovante da conferência ficam disponíveis em **Artifacts** por sete dias.

### Configurar o token uma única vez

1. Gere uma senha aleatória longa em um gerenciador de senhas (por exemplo, 32 caracteres ou mais). Ela será o token administrativo da importação.
2. No Cloudflare, abra o Worker **rede-girassol-api-v-1 → Configurações → Variáveis e segredos**, em **Produção**. Adicione **`IMPORT_TOKEN`** com tipo **Segredo / Secret**, cole o valor gerado e salve/implante a alteração.
3. No repositório GitHub, abra **Settings → Secrets and variables → Actions → New repository secret**.
4. No nome, informe **`REDE_GIRASSOL_IMPORT_TOKEN`**; no valor, coloque **exatamente o mesmo token** do Worker.

O token não é a senha da conta Cloudflare, não é uma chave da API do Cloudflare e não é a URL da API. Não coloque o valor em código, inputs do workflow ou mensagens de chat. O workflow não precisa de credenciais diretas do D1: grava somente pelo endpoint administrativo da API. Para revogar o acesso, troque ou remova `IMPORT_TOKEN` no Worker; atualize também o secret do GitHub se quiser continuar usando a ação.

### Executar a importação

1. Abra [Actions → Importar amostra CNES na API](https://github.com/rafaelrmayer/Rede_Girassol_API_V_1/actions/workflows/cnes-import.yml).
2. Clique em **Run workflow** na branch **`main`**. A ação só executa nessa branch.
3. Mantenha UF **`41`**, município **`410690`** e quantidade **`3`** para o primeiro envio.
4. Confirme **Run workflow**. Essa execução **grava no banco remoto**: insere CNES novos e atualiza os já existentes. Não exclui outros estabelecimentos.
5. Quando terminar verde, abra o [painel](https://rede-girassol-api-v-1.rafael10mayer.workers.dev), clique em **Atualizar** e consulte **Estabelecimentos**. O resumo da execução informa quantos registros foram gravados e conferidos.

O envio valida o hash do arquivo normalizado contra seus metadados e exige resposta de lote concluído. Em seguida, consulta cada CNES pela rota pública e compara os campos enviados. O token é utilizado somente no POST administrativo, sem seguir redirecionamentos; as consultas públicas não levam esse segredo. Execuções de importação são serializadas para evitar concorrência entre esses workflows.

**Falhas:** HTTP `401` indica token ausente/incompatível ou configuração ainda não implantada. HTTP `403` pode indicar bloqueio de acesso pelo Cloudflare. Erro de conexão, timeout ou divergência depois do envio exige conferir o painel e o histórico: a gravação pode ter ocorrido mesmo que a conferência tenha falhado. Não há repetição automática nem rollback da gravação após uma falha na consulta pública. Reenviar os mesmos CNES atualiza os registros sem duplicá-los e cria outra entrada no histórico. A ação de apenas **Preparar amostra CNES** permanece disponível para baixar arquivos sem escrever no banco.

### Identificação do cliente na importação

Os scripts de envio identificam-se como `RedeGirassol-CNES-Importer/0.1` no cabeçalho `User-Agent` e solicitam JSON explicitamente. Na configuração atual do domínio `workers.dev`, o cliente padrão `Python-urllib` recebeu HTTP `403` / erro Cloudflare `1010`, enquanto o cliente identificado chegou à API. Essa identificação não substitui o token administrativo nem altera as regras de acesso.

Após atualizar o código de um workflow, inicie uma **nova execução em Run workflow na `main`** para usar a correção. Reexecutar uma execução antiga usa o commit original daquela execução.

### Lentidão temporária do CNES ou IBGE

A preparação identifica no log o domínio da fonte consultada e tenta cada leitura até três vezes, com timeout de 30 segundos por tentativa e pausas de um e dois segundos. Somente timeouts, falhas de conexão/leitura e HTTP `429`, `500`, `502`, `503` ou `504` recebem novas tentativas. Erros permanentes de acesso, JSON inválido e respostas maiores que o limite interrompem a preparação.

Se a fonte continuar indisponível, a execução termina com o domínio e o motivo resumido do erro, sem avançar ao envio para o banco. Essa repetição vale apenas para as consultas GET das fontes oficiais; o POST de importação continua sem repetição automática. Os dois workflows de CNES usam o mesmo preparador e recebem esse comportamento.

## Paginação das consultas públicas

As rotas `/v1/places`, `/v1/operators` e `/v1/plans` aceitam:

| Parâmetro | Regra |
|---|---|
| `limit` | Inteiro de 1 a 100; padrão 100 para manter compatibilidade |
| `offset` | Quantidade de registros a pular, começando em 0; inteiro seguro até `Number.MAX_SAFE_INTEGER - 100` |

Exemplo: `/v1/places?state=PR&city=Curitiba&limit=20&offset=20` retorna a segunda página de 20 estabelecimentos correspondentes aos filtros. **O offset da nossa API conta registros; o offset da fonte CNES conta páginas.**

A resposta mantém `results` e `count` (quantidade nesta página) e acrescenta `total` (quantidade correspondente aos mesmos filtros), além de `pagination.limit`, `pagination.offset`, `pagination.has_more` e `pagination.next_offset`. Quando não há próxima página, `next_offset` é `null`. Uma página além do fim retorna lista vazia, preservando o total real dos filtros. Parâmetros vazios, repetidos, negativos, fracionários ou fora dos limites retornam HTTP `400` / `invalid_pagination`.

As consultas ordenam por nome e ID, evitando que nomes iguais troquem de posição entre páginas quando a base permanece igual. Contagem e página usam um único batch de leitura D1. Alterações na base entre requisições diferentes ainda podem deslocar registros na paginação por offset.

O painel usa 20 registros por página e oferece **Anterior/Próxima**, preservando os filtros da consulta. Uma nova pesquisa retorna à primeira página. Erros e respostas antigas de pesquisas concorrentes não substituem resultados mais recentes nem são apresentados como uma base vazia.

## Ampliar a carga CNES pelo navegador

Os workflows **Preparar amostra CNES** e **Importar amostra CNES na API** agora incluem os campos:

- **Registros por página:** de 1 a 20 (`limit`).
- **Quantidade de páginas:** de 1 a 5 (`pages`), totalizando até 100 registros por execução.
- **Página inicial CNES:** de 0 a 10000 (`start_page`).

Para ampliar Curitiba, inicie uma nova execução de **Importar amostra CNES na API**, na `main`, com **UF 41**, **município 410690**, **20 registros por página**, **5 páginas** e **página inicial 0**. Isso insere ou atualiza até 100 estabelecimentos, incluindo os CNES já presentes, sem duplicá-los. A quantidade retornada pode ser menor se a fonte acabar antes.

Os metadados do artifact registram cada página consultada, URL, contagem e hash, além de `source_page_size`, `start_page`, `requested_pages`, `source_exhausted` e `next_source_page`. Para continuar, use `next_source_page` como página inicial e mantenha o mesmo número de registros por página. Se for `null`, a fonte retornou uma página curta ou vazia e a leitura chegou ao fim naquele momento. Os índices e a ordem da fonte podem mudar com atualizações do CNES; as cargas não são snapshots nacionais.

O preparador consulta o IBGE uma vez, valida todos os registros e interrompe o lote se encontrar CNES duplicado entre páginas, município incompatível ou falha em qualquer página. Uma página vazia após páginas válidas encerra a carga mantendo os registros já preparados; uma primeira página vazia não gera arquivo de importação. Somente após a preparação completa ocorre o envio único à API.

A API grava até 100 registros em uma transação: grupos de dez linhas por comando SQL, com 80 parâmetros no máximo por comando, e uma entrada de histórico no mesmo batch. Falha em qualquer grupo ou no histórico desfaz o lote inteiro. Essa atomicidade não cobre as consultas de conferência posteriores: se elas falharem, confira o painel e o histórico antes de repetir. Os workflows têm até 15 minutos para concluir.

O CNES aparece em `/sources` e no painel como **integração parcial**. Os totais descrevem somente os estabelecimentos importados; não há sincronização automática, remoção de unidades posteriormente desativadas, comprovação de rede credenciada ou garantia de cobertura integral do município. A integração ANS continua pendente.
