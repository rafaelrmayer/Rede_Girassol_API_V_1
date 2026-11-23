# Encontre apoio — piloto de busca documental

O painel oferece perguntas prontas e busca por palavras em resumos editoriais de fontes oficiais. É a etapa de recuperação de conteúdo de um possível RAG: **não há modelo generativo, embeddings, busca semântica nem chatbot nesta versão**. As respostas são textos revisados e previamente escritos, com fonte, alcance e passos opcionais. Não precisa de conta em provedor de IA, chave ou serviço pago.

## Usar após o deploy

Abra **Encontre apoio** no painel. Escolha “Por onde começar?”, “Apoio para crianças”, “E para adultos?” ou “Apoio aos cuidadores”. Também pode pesquisar “como conseguir encaminhamento?”. O resumo aparece primeiro; “Ver os passos e o alcance da orientação” expande os detalhes. “Limpar” remove a pesquisa e os resultados da tela. O botão de instituições abre **Autismo e apoio**, onde cidade/UF podem ser filtradas na base real.

Não exige SQL, migração, workflow de importação ou segredo novo. Merge e deploy são suficientes. O guia é independente do D1; o catálogo institucional continua dependendo dos dados importados.

## Conteúdo e fontes

O corpus [support-guide.json](../support-guide.json) contém quatro resumos:

- Acesso geral ao SUS: [FAQ oficial do Ministério da Saúde](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/autismo/faq), publicado em 26/08/2025 e atualizado na fonte em 08/10/2025.
- Crianças/adolescentes e cuidadores em Curitiba: [publicação municipal de 02/04/2025](https://www.curitiba.pr.gov.br/noticias/saude-de-curitiba-oferece-atendimento-a-criancas-autistas-e-apoio-aos-pais-e-cuidadores/76757).
- Adultos: declara a lacuna do catálogo, separada da orientação geral de acesso do Ministério. Não afirma que faltam serviços para adultos na cidade ou no país.

Os resumos são paráfrases editoriais, não citações literais nem recomendações clínicas. O piloto não cobre todas as cidades/neurodivergências. A menção a Curitiba fica explícita nos resultados locais, sem aplicar esse fluxo a outra cidade. Resumos de Curitiba podem aparecer na pesquisa por palavras; **não há interpretação automática de localização**. Use os filtros no catálogo institucional.

Revisados em 23/11/2026, com nova revisão até 21/02/2027. A data de revisão documental não é uma confirmação de vagas ou de oferta atual. Após vencer, os resumos deixam de ser enviados pela API e também são filtrados no navegador. Para manter o corpus, verificar fonte e escopo, ajustar os textos e registrar nova revisão com prazo de até 90 dias. Mudanças precisam passar pelo fluxo de revisão do repositório.

## Pesquisa e privacidade

`GET /v1/support-guide` devolve o pequeno corpus vigente sem consultar o banco. Não aceita parâmetros, perguntas ou dados pessoais; qualquer query string retorna 400. A rota está no OpenAPI e na documentação interativa.

A interface baixa esse corpus e pesquisa **localmente**, ignorando acentos e maiúsculas, por palavras-chave explícitas. Retorna até três resumos correspondentes; consultas com palavras de público adulto excluem o conteúdo infantil. Não usa classificação de diagnóstico, histórico pessoal, localização automática ou dados de pacientes. Sem correspondência, apresenta a lacuna e oferece as perguntas prontas.

O texto digitado não é enviado pelo código do painel em URLs ou requisições, nem salvo em localStorage ou banco. O servidor ainda pode ter logs técnicos normais de acesso aos endpoints. O aviso da interface pede para não informar nomes, diagnósticos individuais ou outros dados pessoais. Não há persistência de conversa ou integração com provedores de IA.

## Validação e evolução

Os testes verificam corpus sem banco, recusa de parâmetros, fontes/datas/escopo e retirada após expiração. A validação no navegador cobre pesquisa com acentos/maiúsculas, perguntas prontas, público adulto, conteúdo não coberto, limpeza, links, navegação, desktop/celular e ausência do texto pesquisado nas requisições. Renderização usa textContent e links HTTPS governamentais.

Próximas etapas possíveis: avaliar com usuários, ampliar o corpus com fontes específicas de adultos e outras neurodivergências e, se trouxer benefício, integrar geração fundamentada. Um RAG completo exigirá provedor, avaliação de fidelidade às fontes e tratamento explícito de lacunas. Esta versão não é apresentada como essa etapa concluída.
