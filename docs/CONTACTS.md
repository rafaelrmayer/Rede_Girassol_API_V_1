# Contatos institucionais

As listas de estabelecimentos, reabilitação e Autismo e apoio, além do detalhe de estabelecimento, incluem o objeto `contact`. O painel mostra links para ligar e, quando publicado e conferido, e-mail institucional. Fonte, contexto e data ficam em detalhes recolhidos. Um número não é identificado como WhatsApp sem publicação explícita; esta carga não inclui WhatsApp.

Não precisa de migração, SQL, segredo ou nova importação. O registro de contatos é versionado em [institutional-contacts.json](../institutional-contacts.json) e ligado pelo CNES. Cadastros sem contato elegível mostram “Contato não confirmado”. A carga inicial tem contatos para 17 dos 19 CNES da amostra de reabilitação, incluindo as seis instituições da busca de autismo. Não significa cobertura nacional.

## Fontes e decisões da revisão de 23/11/2026

- **Encantar**: [portal municipal de locais](https://locais.curitiba.pr.gov.br/ambulatorio-encantar/2052), com os números (41) 3223-4114 e (41) 3233-7199. O e-mail da ouvidoria municipal não foi apresentado como canal de agendamento.
- **APAE Luan Muller, Santa Felicidade e Cedae**: [FAQ da APAE Curitiba](https://apaecuritiba.org.br/novidades/perguntas-frequentes/) publica a central administrativa (41) 3322-9339. A mesma central aparece nos três cadastros com indicação explícita de que não é uma linha direta da unidade. A pessoa deve informar qual unidade procura. As mudanças de organização/unificação das escolas descritas pela instituição impedem tratar rodapés antigos como contatos diretos atuais; não alteramos os nomes dos perfis CNES.
- **FEPE de Curitiba**: [site da própria fundação](https://www.fepe.org.br/contato/), contato geral (41) 3111-1800 e e-mail da secretaria administrativa `contato@fepe.org.br`. Não confundir com a FEPE de apoio à UFMG, em outro domínio. O laboratório possui outro setor; o contato geral não é apresentado como linha específica de terapias.
- **Neurointerage e demais registros elegíveis**: telefone institucional publicado na API oficial CNES `/cnes/estabelecimentos/{cnes}`. A fonte individual e a data cadastral estão em cada entrada. Não copiamos e-mails pessoais ou perfis de pessoas físicas. Número móvel cadastrado não vira WhatsApp automaticamente.

A identidade foi conferida por CNES e município (Curitiba, IBGE 410690). Números usam formato internacional `+55` com DDD; o prefixo de discagem nacional zero é removido. Para números locais de oito dígitos desta seleção, DDD 41 corresponde ao município conferido. Valores sem formato reconhecido não foram incluídos. Há telefones gerais compartilhados entre instituições; não os interpretamos como atendimento clínico direto.

**Conferência documental não é ligação de teste.** `published` informa que o contato foi encontrado em fonte institucional/cadastral, não que a linha está ativa, o e-mail responde, existe vaga ou o serviço aceita acesso direto. `source_kind: cnes` diferencia dados cadastrais de páginas da instituição (`institution`) ou do município (`municipality`). `source_updated_on` preserva a data informada pelo CNES; a conferência em 23/11 não atualiza essa data antiga nem garante atualidade operacional.

## Contrato e manutenção

`contact` contém:

- `status`: `published` ou `not_verified`.
- `phones`: lista de `number` e `label`, com identificação do setor/central quando conhecida.
- `email`, `website`: canal institucional ou `null`.
- `source_url`, `source_kind`, `source_updated_on`: procedência e data cadastral quando disponível.
- `reviewed_on`, `review_due_on`: conferência documental e prazo de revisão.
- `note`: limitações do canal.

Prazo inicial até **21/02/2027**, no máximo 90 dias após a revisão. Contatos vencidos são retirados das respostas até nova conferência: `not_verified`, lista de telefones vazia e demais campos nulos, além da mensagem. Não há busca ao vivo nas fontes durante as consultas nem raspagem contínua. Alterações no registro precisam passar por revisão no repositório.

O novo campo é aditivo e opcional no esquema público para preservar os exemplos anteriores. As implementações atuais dessas quatro consultas o incluem mesmo quando não há contato conhecido. OpenAPI e documentação interativa descrevem o objeto. Nenhum endpoint administrativo permite inserir contatos pessoais por esse recurso.
