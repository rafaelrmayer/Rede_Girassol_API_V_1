# Revisão de fontes e reutilização — 23/11/2026

Esta revisão registra o que foi encontrado nas fontes públicas. Não equivale a uma autorização recebida dos titulares nem a parecer jurídico. O projeto não enviou pedidos em nome do responsável. A declaração de direitos do marketplace continua sendo uma decisão do publicador, conforme o escopo e os termos efetivos.

## CNES: dados e aviso do portal

Foram consultados os conjuntos [estabelecimentos](https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude) e [serviços especializados](https://dadosabertos.saude.gov.br/dataset/cnes_servicos_especializados). Ambos trazem um aviso geral de **CC BY-ND 3.0**, enquanto a área de licença específica termina com texto genérico sem identificar claramente uma licença de cada recurso. A tentativa de consultar metadados CKAN pela rota package_show não forneceu confirmação adicional.

A [orientação oficial de dados abertos do Ministério](https://www.gov.br/saude/pt-br/acesso-a-informacao/dados-abertos/dados-abertos) descreve livre uso/cruzamento com atribuição. O [Decreto 8.777/2016, texto atualizado, art. 4º](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8777.htm) trata de livre utilização de dados federais e distingue direitos patrimoniais da União de material pertencente a terceiros. Isso fundamenta a análise dos dados públicos, sem estender automaticamente a regra a textos municipais ou de instituições privadas.

A [CC BY-ND 3.0](https://creativecommons.org/licenses/by-nd/3.0/deed.pt-br) admite redistribuição, inclusive comercial, com atribuição, mas impõe condições sobre material adaptado. A própria página distingue mudança de formato de criação de obra derivada. Portanto, o aviso **não é uma proibição automática de uso comercial**, e tampouco basta para afirmar que qualquer seleção, adaptação ou resumo de qualquer fonte está liberado.

A API normaliza identificadores/campos e seleciona observações institucionais. Não redistribui os PDFs, imagens ou páginas integrais das fontes. Manter os links, competências, datas e identificação do CNES; não atribuir licença própria aos dados de terceiros. A dúvida documental remanescente é a aplicação da licença/condições aos recursos específicos e à distribuição pretendida. Não registramos uma confirmação inexistente.

## Conteúdo municipal, orientações e contatos

A curadoria usa fatos de atendimento e resumos editoriais, com links e datas, das publicações municipais e da FAQ do Ministério; não copia artigos integrais, depoimentos de pacientes, fotografias ou logotipos. O aviso de licença de um portal federal não foi aplicado às notícias municipais. Não foi localizada nesta revisão uma autorização municipal abrangente para todo conteúdo.

Os contatos são fatos institucionais publicados e conferidos por identidade, não listas de contatos pessoais. As páginas próprias da APAE e FEPE sustentam os canais da central/secretaria indicados; não tornam outros materiais dessas instituições reutilizáveis. O registro continua distinguindo contatos CNES de contatos de página institucional. Fontes individuais estão em [CONTACTS.md](CONTACTS.md), [REHABILITATION.md](REHABILITATION.md) e [SUPPORT_GUIDE.md](SUPPORT_GUIDE.md).

## Ações concretas e dúvida a esclarecer

O pacote mantém procedência e resumos próprios, sem marcas/imagens de terceiros. Não foi criada cobrança, alterada visibilidade ou enviada uma declaração de direitos. Para esclarecer os recursos CNES, o responsável pode enviar ao canal oficial de acesso à informação do Ministério a mensagem abaixo, com os links dos conjuntos e exemplos dos campos (sem arquivo do banco, credenciais ou dados pessoais):

> Sou responsável pela Rede Girassol API, projeto independente que consulta e normaliza dados públicos institucionais do CNES. Pretendo disponibilizar consultas de identificação de estabelecimentos, serviços especializados, competência e contatos institucionais publicados, preservando atribuição e links. Poderiam informar a licença e as condições aplicáveis à redistribuição desses recursos por API, inclusive por marketplace com eventual cobrança pelo serviço técnico? O aviso geral CC BY-ND 3.0 refere-se ao conteúdo do portal ou também aos arquivos e à API desses dois conjuntos? A seleção de registros e normalização de campos mantidos com seus valores de origem possui alguma condição específica?

Não é necessário solicitar uma autorização genérica para todo uso de dado público sem antes considerar as regras aplicáveis. Esta consulta é para resolver a ambiguidade documental identificada. Um piloto gratuito não elimina condições de licença; uma cobrança também não é automaticamente proibida pelo aviso encontrado.
