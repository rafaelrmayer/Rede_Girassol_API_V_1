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
