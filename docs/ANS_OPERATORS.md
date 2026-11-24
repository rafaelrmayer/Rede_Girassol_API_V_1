# Operadoras ANS — carga completa, comparação e preparação para atualização mensal

A primeira integração importa os cadastros de **operadoras ativas e com registro cancelado**, sem vincular estabelecimentos a planos. Produtos/planos e rede credenciada continuam pendentes. Município e UF representam a sede da operadora, não área de cobertura.

## Usar pelo navegador

1. Faça o merge da implementação e aguarde o deploy do Worker.
2. Abra Cloudflare → D1 → **rede-girassol-db → Console** e execute todo o conteúdo de [0003_ans_operators.sql](../migrations/0003_ans_operators.sql). É uma migração aditiva e idempotente: cria tabelas/índices sem apagar os dados anteriores. Não precisa editar as tabelas CNES ou criar banco novo.
3. GitHub → Actions → **Preparar ou importar operadoras ANS → Run workflow → main**. Com a opção de publicação **desmarcada**, a execução só baixa, valida e gera o artifact. Não grava no banco e não precisa de segredo para preparar.
4. Confira o resumo e o artifact `ans-operadoras-…`, disponível por sete dias. `ans-operadoras.json` contém somente os campos institucionais usados pela API, metadados e hashes; não contém nomes de representantes ou CNPJ.
5. Execute novamente na main, agora **marcando a opção de gravar**. Reutiliza o GitHub secret `REDE_GIRASSOL_IMPORT_TOKEN`, que deve corresponder ao `IMPORT_TOKEN` do Worker. Não é necessário criar outra chave ou compartilhar valores.
6. O workflow confere autenticação/deploy/migração antes do download, publica uma única carga e verifica o identificador, hash e contagem do snapshot gravado. O resumo informa inclusões, alterações de campos, mudanças de situação e ausências na última fonte. O comprovante fica no artifact.
7. Recarregue o painel. **Operadoras ANS só aparece após existir um snapshot completo confirmado**. Pesquise razão social, município/UF da sede e situação cadastral. A rota `/v1/operators` e sua documentação também ficam disponíveis.

A validação desta implementação foi feita com **1.101 ativas e 3.085 canceladas, total de 4.186**, nos arquivos oficiais de 24/11/2026. São contagens observadas nessa data, não constantes nem uma importação em produção já realizada por esta alteração. Validar o primeiro envio real no ambiente remoto continua necessário, inclusive os limites do Worker contratado.

## Fontes e campos

- [Ativas — diretório ANS](https://dadosabertos.ans.gov.br/FTP/PDA/operadoras_de_plano_de_saude_ativas/): `Relatorio_cadop.csv`, com dicionário ODS no mesmo local.
- [Canceladas — diretório ANS](https://dadosabertos.ans.gov.br/FTP/PDA/operadoras_de_plano_de_saude_canceladas/): `Relatorio_cadop_canceladas.csv`, dicionários PDF/ODS.
- [Página institucional de dados abertos da ANS](https://www.gov.br/ans/pt-br/acesso-a-informacao/perfil-do-setor/dados-abertos-1).

Arquivos observados: CSV UTF-8 com BOM, delimitador `;`, cabeçalhos em maiúsculas. O preparador exige os campos utilizados, preserva registro ANS com seis dígitos e valida datas, UF, duplicações, identidade nas duas fontes e cronologia. Alterações incompatíveis de cabeçalho/encoding interrompem a carga, sem adivinhar o formato. Campos adicionais não utilizados são descartados.

| Campo ANS | Campo da consulta |
|---|---|
| REGISTRO_OPERADORA | ans_code, texto de seis dígitos |
| RAZAO_SOCIAL / NOME_FANTASIA | name / trade_name |
| MODALIDADE | modality |
| CIDADE / UF | city / state, localização da sede |
| DATA_REGISTRO_ANS | registered_on |
| DATA_DESCREDENCIAMENTO | cancelled_on, somente fonte cancelada |
| MOTIVO_DO_DESCREDENCIAMENTO | cancellation_reason, quando informado |
| Arquivo ativo ou cancelado | status: active ou cancelled |

Não são importados CNPJ, representante, cargo, endereço residencial, informações de beneficiários ou e-mails/telefones desta fonte. Contatos institucionais CNES já existentes são outro recurso, sem associação automática a estas operadoras.

`active_source_date` e `cancelled_source_date` vêm do cabeçalho HTTP **Last-Modified**, em UTC. São datas do arquivo, não alteração individual nem data de registro da operadora. O `source_updated_at` de cada operadora gerenciada aponta para a data do arquivo correspondente. Ausência desse cabeçalho interrompe o download; não substituímos por “hoje”. `prepared_at`, `imported_at` e `last_checked_at` têm significados separados.

No modo de CSV local, as datas são fornecidas explicitamente e não se afirma download autenticado. Os hashes ajudam a comparar conteúdo; não são assinatura digital ou garantia independente de autenticidade. A procedência é declarada pelo preparador/importador autorizado, com URLs oficiais fixas no servidor.

## Consistência, alterações e falhas

A carga contém **ambos os arquivos completos**, sem filtros de UF, amostras ou paginação da origem. Ativas não podem ser tratadas como o cadastro completo sozinhas. Registros presentes em ambas as fontes, vazios, duplicados ou com datas incompatíveis fazem a preparação falhar.

O Worker aceita até 10 mil registros e 2 MiB de corpo, valida tudo antes da gravação e verifica o hash canônico. A transação D1 preserva IDs existentes das operadoras, referências de produtos e todo o banco CNES. Armazena o snapshot e seu histórico com os dados institucionais normalizados, sem os demais campos do CSV bruto. A consulta pública continua lendo as tabelas normalizadas.

- Uma operadora expressamente na fonte cancelada recebe `cancelled` e a data do arquivo. Ausência na fonte seguinte vira `not_in_latest_source`, **nunca cancelamento inferido ou exclusão**.
- Ausentes conservam a procedência do último registro conhecido. O status explicita que não foram encontrados na carga mais recente.
- Inclusões e ausências são diferenças em relação ao snapshot anterior; uma reaparição pode contar como inclusão nessa comparação, sem significar primeiro registro histórico na ANS.
- Se a carga tiver fonte mais antiga ou redução superior a 10% no total, nas ativas ou nas canceladas, é bloqueada para revisão, sem botão de forçar. Uma mudança legítima desse tamanho exige inspeção da fonte e ajuste revisado do processo, não alteração da situação por suposição.
- Se outro envio trocar o snapshot entre a leitura e o commit, o controle de versão impede sobrescrever a nova base. Uma falha em qualquer gravação/histórico faz rollback integral.
- Mesmos registros e mesmas referências/hashes resultam em `unchanged`, sem duplicar o snapshot. A checagem é registrada no histórico e atualiza `last_checked_at`.
- Novas tentativas automáticas são somente para leituras transitórias das fontes. **O POST não é repetido**. Em timeout ou falha de conferência depois do envio, verificar histórico antes de reenviar.

Snapshots e seu diff ficam armazenados para auditoria; retenção e crescimento do banco devem ser acompanhados. Arquivos brutos não são distribuídos pelo artifact.

## API

`GET /v1/operators` aceita `q` (razão social), `city`, `state`, `status`, `ans_code`, `limit` e `offset`. `status` também pode ser `unconfirmed` para registros legados que não foram gerenciados por esta carga. Sem filtro de situação, retorna todas as situações disponíveis. Filtros repetidos ou registro ANS fora de seis dígitos retornam 400. Antes da migração, a consulta legada por nome continua funcional; novos filtros recebem 503.

A fonte ANS em `/sources` informa `operators_ready`, datas dos dois arquivos e integração parcial somente depois da primeira carga confirmada. Isso não declara integração de planos ou rede credenciada.

Rotas administrativas protegidas pelo token existente:

- `GET /admin/ans/operators/state`: metadados do snapshot atual ou `snapshot: null`.
- `POST /admin/ans/operators/snapshot`: lote completo, metadados e `expected_snapshot_id` para controle de concorrência. Limites reais de corpo são conferidos mesmo sem Content-Length.

O pacote RapidAPI passa a **oito consultas**, incluindo operadoras, após a validação da primeira carga. O namespace `/rapidapi/v1/operators` exige o Proxy Secret existente. A publicação do marketplace continua separada; não exponha as rotas administrativas. Não é necessário alterar os endpoints anteriores; a nova consulta precisa ser adicionada/importada na definição da listagem quando os dados estiverem prontos.

## Atualização mensal preparada, ainda desativada

O mesmo workflow já suporta uma futura execução agendada; o cron está **comentado**. Após validar a primeira carga manual em produção:

1. Habilitar a variável de repositório `ANS_MONTHLY_SYNC_ENABLED` com valor `true`.
2. Em mudança revisada, ativar o bloco `schedule` indicado no workflow: dia 2 de cada mês às 08h17 UTC (05h17 de Brasília). O GitHub pode atrasar a execução.
3. A execução agendada usa a mesma validação, trava de concorrência, comparação, publicação atômica e artifact, sem inputs ou segredo em texto.
4. Conferir o primeiro agendamento e acompanhar falhas no Actions. Este código não configura alertas externos, envio de mensagens nem repetição de POST.

A guarda da variável impede publicação por agendamento enquanto ela não estiver habilitada. Nesta entrega **não existe agendamento ativo**. A versão atual das fontes pode ser atualizada mais frequentemente pela ANS; verificar mensalmente é a frequência operacional escolhida para a Girassol, não uma afirmação sobre a periodicidade oficial.
