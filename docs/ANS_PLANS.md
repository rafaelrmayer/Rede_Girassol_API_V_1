# Catálogo nacional de planos ANS

Esta integração prepara **todos os registros** do arquivo oficial de características dos produtos: ativos, suspensos, cancelados e transferidos. A primeira carga remota ainda precisa ser executada e conferida pelo responsável. A preparação local de 24/11/2026 encontrou **166.759 planos**, divididos em 668 partes; isso não comprova que a carga já esteja em produção.

## Fonte, identidade e limites

- [CSV oficial de características dos produtos](https://dadosabertos.ans.gov.br/FTP/PDA/caracteristicas_produtos_saude_suplementar-008/pda-008-caracteristicas_produtos_saude_suplementar.csv).
- [Dicionário oficial](https://dadosabertos.ans.gov.br/FTP/PDA/caracteristicas_produtos_saude_suplementar-008/dicionario-pda-008-caracteristicas_produtos_saude_suplementar.ods).
- `ID_PLANO` é a chave única. `CD_PLANO` é o registro ou código SCPA: pode conter letras, zeros e repetições entre operadoras. Não presumir nove dígitos nem usar o código como identidade única.
- O vínculo com a operadora usa `REGISTRO_OPERADORA` de seis dígitos. A publicação exige que todos os códigos existam no catálogo de operadoras; não faz correspondência por nome.
- `DT_ATUALIZACAO` é a data de atualização do conjunto, apresentada como `source_updated_at`. `DT_SITUACAO` descreve a situação desde aquela data; `DT_REGISTRO_PLANO` pode ser nulo nos planos antigos. `Last-Modified` do arquivo fica separado como `file_date`; não substituir por data de download.
- O preparador mantém contratação, segmentação, categoria de abrangência, acomodação e fator moderador. Caracteres de controle no nome comercial são substituídos por espaço para apresentação; nenhum registro é descartado por esse ajuste. Identificadores são preservados.
- **Ativo não garante comercialização, atendimento a TEA, cobertura de procedimento, prestador, contato ou vaga.** A categoria de abrangência não identifica os municípios atendidos. A tabela auxiliar de municípios e a rede credenciada não foram integradas. A situação da operadora é independente da situação do produto.

## Capacidade antes de gravar

A carga nacional é maior que a primeira carga de operadoras. No [D1 gratuito](https://developers.cloudflare.com/d1/platform/pricing/), a cota é de 100 mil linhas escritas/dia; índices também contam. O [limite de armazenamento por banco gratuito](https://developers.cloudflare.com/d1/platform/limits/) é 500 MB. Conferir o plano e as métricas reais no painel antes de iniciar. Este código não muda assinatura ou cobrança.

Por padrão, o servidor limita **esta importação** a **15 mil registros novos por dia UTC**, somando todas as execuções e snapshots. O orçamento é reservado na mesma transação das partes e não é gasto novamente ao reenviar uma parte confirmada. Há índices e tabelas auxiliares além dos próprios registros: o teto deixa margem, mas **não mede nem garante a disponibilidade da cota global da conta**, compartilhada com outras operações/projetos. Limite de armazenamento, falhas do serviço e uso externo ainda podem interromper a carga. Evite executar outros imports volumosos simultaneamente.

Ao atingir o teto local, a API retorna `429 daily_plan_import_budget_reached`; o workflow fica interrompido, sem publicar o conjunto incompleto. Retomar depois da virada UTC, usando o mesmo pacote. Com 166.759 registros e o padrão de 15 mil/dia, a primeira carga requer aproximadamente **12 dias de envio**, se a cota e o armazenamento permitirem. Não há retomada diária automática nesta entrega.

**Somente após conferir uma capacidade maior na conta**, o responsável pode definir a variável de runtime `ANS_PLANS_DAILY_RECORD_LIMIT` no Worker, de `250` a `250000`, para ajustar o teto de registros/dia. Não é segredo e não contrata capacidade adicional. Não aumentar esse teto no plano gratuito para tentar contornar os limites da plataforma. Nos testes locais, `250000` permite verificar o catálogo completo sem gravar na Cloudflare.

## Primeira carga pelo navegador

1. Fazer merge da alteração e aguardar o deploy automático do Worker.
2. Em Cloudflare → D1 → `rede-girassol-db` → Console, executar **somente** [0004_ans_plans.sql](../migrations/0004_ans_plans.sql). É aditiva e repetível; não apaga estabelecimentos, operadoras, produtos legados ou vínculos existentes.
3. Confirmar que a carga de operadoras já foi validada. Se um vínculo não resolver, atualizar operadoras antes de concluir os planos.
4. Em GitHub → Actions → **Preparar ou importar planos ANS** → Run workflow, manter `prepared_run_id` vazio e `publish` desmarcado para somente baixar, validar e guardar o arquivo preparado. Nenhum dado é gravado nesse modo. Também é possível marcar `publish` quando a capacidade já tiver sido conferida.
5. Para publicar o pacote já preparado, executar novamente, informando em `prepared_run_id` o ID numérico da execução anterior e marcando `publish`. Não baixar uma versão nova para retomar uma carga: a fonte muda diariamente, e isso iniciaria outro snapshot.
6. Se interromper, as partes aceitas permanecem reservadas e invisíveis. Repetir com o mesmo `prepared_run_id`: o publicador consulta os hashes recebidos e envia somente as partes ausentes. O artifact é salvo **antes do primeiro POST** e mantido por **30 dias**. Cada retomada também guarda uma cópia que pode ser usada como origem da próxima retomada.
7. Quando todas as partes forem aceitas, a API confere contagens e os vínculos, calcula alterações, publica o snapshot e registra o histórico em uma transação. O publicador confere a identidade/contagem do estado e uma consulta pública. Repetir o mesmo pacote completo resulta em `unchanged`.
8. Conferir `/v1/plans?limit=2`, `/v1/plans?status=active&limit=2`, `/sources` (`plans_ready=true`, data e contagem) e o menu **Planos ANS** no painel. O menu fica oculto antes da publicação completa.

O segredo GitHub `REDE_GIRASSOL_IMPORT_TOKEN` e o `IMPORT_TOKEN` no Worker continuam os mesmos. Não copiar valores para o repositório ou chat. O publicador não repete POST automaticamente: em timeout, verificar o estado e retomar o pacote.

## Consultas e staging

`GET /v1/plans` aceita `q`, `ans_code`, `registration_code`, `plan_id`, `status`, `limit` e `offset`. `q` busca parte do nome com LIKE, limitado a 48 bytes UTF-8 por restrição do D1; `%` e `_` são curingas. Os demais filtros são exatos. `status` aceita `active`, `suspended`, `cancelled`, `transferred`. Não há filtro geográfico de cobertura; parâmetros não suportados ou repetidos retornam 400. Paginação: 1–100 registros, padrão 100; painel usa 20.

Rotas administrativas, todas com Bearer token:

- `GET /admin/ans/plans/state`: identidade, datas, contagens e histórico resumido do snapshot público; 503 antes da migração.
- `POST /admin/ans/plans/begin`: manifesto nacional com hashes de cada parte, hash do arquivo, datas e baseline esperado.
- `POST /admin/ans/plans/chunk`: até 250 registros, corpo até 512 KiB, validado pelo hash do manifesto; reenvio confirmado não duplica nem gasta o orçamento outra vez.
- `POST /admin/ans/plans/commit`: confere completude, vínculos e concorrência; só então troca o ponteiro público junto com o histórico.

Arquivos vazios, cabeçalhos alterados, IDs duplicados, datas impossíveis, situações desconhecidas, fonte anterior ou redução superior a 10% bloqueiam a publicação. Ausências são contadas como `not_in_latest_source`, sem inventar cancelamento. O catálogo anterior permanece consultável durante o próximo staging, sujeito à disponibilidade do D1. Falha na gravação do histórico reverte a publicação. Um import concorrente não pode substituir um baseline diferente silenciosamente.

As partes são validadas por SHA-256 e contagens; o hash do arquivo é proveniência declarada pelo preparador autenticado, não uma assinatura digital da ANS. As rotas públicas consultam somente o snapshot publicado. Dados legados em `products` permanecem acessíveis antes da primeira carga nacional para compatibilidade; não são misturados ao catálogo nacional validado.

Snapshots antigos e staging interrompido **consomem armazenamento** e ficam preservados nesta entrega. Não iniciar pacotes novos repetidamente nem ativar uma rotina de planos sem definir retenção/limpeza e medir espaço disponível. Não apagar snapshots referenciados ou reduzir a base para vencer uma validação sem revisão.

## RapidAPI e atualização futura

A definição preparada passa a **nove consultas GET**, com planos no namespace protegido `/rapidapi/v1/plans`. Os caminhos administrativos continuam fora do gateway. A importação da nova definição e a publicação na conta RapidAPI são manuais e separadas da carga. Adicionar planos ao marketplace após a conferência remota do catálogo nacional.

O workflow de planos é **manual**, sem cron. O cron mensal de **operadoras** continua ativo conforme [ANS_OPERATORS.md](ANS_OPERATORS.md). Automatizar planos fica para depois da primeira carga e repetição validadas, da conferência de capacidade e da política de retenção; não anunciar atualização mensal automática de planos nesta etapa.
