# Autismo e apoio: fontes e configuração

O painel tem duas consultas independentes:

- **Autismo e apoio**: busca por nome, cidade e UF entre instituições com evidência oficial explícita de atendimento a pessoas autistas, revisada manualmente. Mostra público, forma de acesso informada e publicação da fonte. Não confirma vagas, atendimento atual para todas as idades ou cobertura por plano/SUS.
- **Reabilitação**: observações mensais do serviço CNES 135, com filtros de modalidade e mês. Inclui registros próprios e de terceiros; não comprova oferta presencial no endereço da instituição nem habilitação como CER. A modalidade intelectual 002 não basta para afirmar atendimento a TEA.

Nenhum resultado é uma indicação clínica. Não são coletados dados de pacientes, diagnósticos individuais, CPF ou endereço residencial.

## Ativar pelo navegador

1. No Cloudflare, abra **Banco de dados SQLite D1 → rede-girassol-db → Console**.
2. Copie e execute o conteúdo de [migrations/0002_rehabilitation.sql](../migrations/0002_rehabilitation.sql). Ele cria a tabela e índices de observações, sem apagar ou alterar perfis existentes. Pode ser executado novamente.
3. Faça o merge e aguarde o deploy principal do Worker. Recarregue o painel.
4. No GitHub, abra **Actions → Importar serviços de reabilitação CNES → Run workflow**, usando a branch **main**. Os padrões são PR, município IBGE **410690**, competência **202607**, classificação **002**, limite **20**.
5. Confira o resultado verde e o resumo. O artifact guarda lote, metadados e comprovante por sete dias. Os dados aparecem em **Reabilitação**. A busca **Autismo e apoio** também exige o perfil institucional correspondente no banco; a importação cria esse perfil quando ausente.

O workflow reutiliza o secret GitHub `REDE_GIRASSOL_IMPORT_TOKEN`, correspondente ao secret `IMPORT_TOKEN` do Worker. Não precisa de chave nova. Antes de baixar a fonte, confere autenticação, deploy e disponibilidade da tabela. O arquivo anual consultado tem aproximadamente 232 MB; o processamento pode levar alguns minutos. Somente os pequenos JSONs preparados entram no artifact.

## Primeiro atendimento documentado

O registro inicial de curadoria é o **Centro de Especialidades Médicas Encantar**, CNES **0015466**, Curitiba/PR. Fontes:

- [Prefeitura de Curitiba, 30/03/2026](https://www.curitiba.pr.gov.br/noticias/prefeito-lanca-programa-para-quadruplicar-atendimento-a-criancas-autistas-ate-o-fim-do-ano/82418): informa atendimento multiprofissional a crianças e adolescentes com TEA no Encantar matriz. O anúncio de uma unidade Sul futura não foi tratado como atendimento já disponível.
- [Prefeitura de Curitiba, 02/04/2025](https://www.curitiba.pr.gov.br/noticias/saude-de-curitiba-oferece-atendimento-a-criancas-autistas-e-apoio-aos-pais-e-cuidadores/76757): orientação de acesso pela unidade de saúde de referência, avaliação e encaminhamento conforme critérios do serviço.
- [Identidade institucional no CNES](https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/0015466).

Revisão documental: **23/11/2026**; prazo para nova revisão: **21/02/2027**. Revisar uma publicação não equivale a telefonar e confirmar agenda. O endereço não é exibido nessa busca, pois a fonte cadastral consultada e a notícia de mudança podem refletir momentos diferentes.

A curadoria fica em [autism-support-sources.json](../autism-support-sources.json), versionada no repositório. Para adicionar uma instituição, verificar a identidade CNES, fonte governamental que mencione explicitamente o atendimento a TEA, público e critérios de acesso; registrar publicação, revisão e prazo de até 90 dias. As URLs precisam ser HTTPS governamentais. Evidência expirada deixa de ser elegível automaticamente. Importações administrativas não podem definir esse status. Nome contendo “autismo”, especialidade ou reabilitação intelectual não substituem a evidência. Catálogo inicial e não exaustivo: ausência de resultado não significa ausência de atendimento na cidade.

## Ampliação revisada em 23/11/2026

Além do Encantar, foram vinculadas cinco instituições já presentes na carga padrão de 19 observações:

| Instituição citada na fonte municipal | Nome no CNES | CNES |
|---|---|---|
| APAE Luan Muller | ESCOLA ESPECIAL LUAN MULLER | 3282910 |
| APAE Santa Felicidade | APAE SANTA FELICIDADE | 3282961 |
| APAE Cedae | CEDAE APAE CURITIBA | 3282929 |
| FEPE | FEPE | 2774925 |
| Clínica Neuro Interage | NEUROINTERAGE REABILITACAO DESENVOLVIMENTO HUMANO | 5750075 |

A [publicação municipal de 30/03/2026](https://www.curitiba.pr.gov.br/noticias/prefeito-lanca-programa-para-quadruplicar-atendimento-a-criancas-autistas-ate-o-fim-do-ano/82418), seção “Novos serviços credenciados”, identifica esses prestadores no programa de terapias para TEA. Cada identidade foi conferida no endpoint oficial CNES indicado no registro de curadoria. O público informado é de crianças e adolescentes; não ampliamos essa afirmação para adultos.

Mantemos a [orientação municipal de acesso](https://www.curitiba.pr.gov.br/noticias/saude-de-curitiba-oferece-atendimento-a-criancas-autistas-e-apoio-aos-pais-e-cuidadores/76757): unidade de saúde de referência, avaliação e encaminhamento. A descrição da rede contratada na publicação não foi convertida em garantia de cobertura atual, vaga disponível ou acesso direto. Alguns campos administrativos do CNES refletem outra data e não coincidem com a descrição de contratação municipal; por isso é necessário confirmar com a rede responsável.

Esta ampliação usa os mesmos campos, regras e prazo de revisão do registro inicial. Após o deploy, uma base que já recebeu a carga padrão passa a mostrar **seis instituições** em Autismo e apoio, mantendo **19 observações** em Reabilitação. Não exige SQL, nova importação nem alteração de segredos. Instituições com nome ambíguo ou unidade não identificada não foram incluídas.

## Fonte mensal de reabilitação

- [CNES — Serviços especializados](https://dadosabertos.saude.gov.br/dataset/cnes_servicos_especializados).
- [Classificações do serviço 135 — Portaria SAES/MS 2.151/2024](https://bvsms.saude.gov.br/bvs/saudelegis/Saes/2024/prt2151_16_10_2024.html).
- [Arquivo anual oficial de 2026](https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/saes/drac/CNES_Servico_Espec/csv/cnes_servicos_espec_cadastrados_2026_csv.zip).

Na inspeção em 23/11/2026, o ZIP tinha arquivos de janeiro a julho. O padrão **202607 é histórico**, sem promessa de atualização posterior. A seleção de Curitiba/classificação 002 encontrou 19 observações em 19 instituições. Isso não transforma as outras instituições em atendimento confirmado a pessoas autistas. Meses futuros ausentes geram erro explícito; nunca substituímos silenciosamente o mês solicitado.

O preparador lê o CSV UTF-8 separado por ponto e vírgula, filtra município, serviço 135 e classificação opcional, preserva zeros iniciais do CNES e distingue PROPRIO/TERCEIRO. O limite é de 1 a 100 observações, sem inferir cobertura territorial. Metadados registram arquivo/membro, hash do download oficial, hash do lote, filtros, competência, linhas percorridas e se a leitura terminou ou parou no limite. O modo de ZIP local identifica essa procedência separadamente.

A gravação é atômica com histórico. Perfis existentes mantêm IDs, nomes, endereços e datas. Perfis ausentes recebem somente identificação institucional mínima. Nome/cidade/UF da observação mensal ficam separados do perfil. Reimportar a mesma combinação instituição/classificação/tipo/mês atualiza essa observação sem duplicá-la. Meses anteriores ficam consultáveis; sem filtro de mês, a API mostra a última observação importada por combinação, sem alegar cadastro atual completo.

## API e validação

`GET /v1/autism-support` e `GET /v1/rehabilitation` são públicos, paginados e descritos no [OpenAPI](../openapi.json). `documented` significa evidência documental válida; `not_verified` não afirma que o serviço não atende. A rota de reabilitação retorna 503 quando a tabela está indisponível; o restante do painel continua utilizável.

Os testes cobrem importação transacional, preservação dos perfis, histórico mensal, idempotência, limites, filtros, curadoria independente, expiração, contratos OpenAPI e preparação/publicação Python. A validação local usa banco separado; não executa migrações nem importações em produção. Antes da publicação comercial no RapidAPI, revisar licença e condições de reutilização de cada fonte, além de autenticação, limites e oferta comercial.
