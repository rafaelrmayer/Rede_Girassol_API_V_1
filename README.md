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
