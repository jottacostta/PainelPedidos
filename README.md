# JBS Reposição — V19

Sistema web offline para gestão de reposição de mercadorias e acompanhamento operacional do CPD. A aplicação-base é o arquivo original `JBS_REPOSICAO_OFFLINE_CPD_IMPRESSAO_V19.html`, preservado em `index.html`.

## Funcionalidades

- Importação de relatórios ERP e cálculo de sugestões de reposição.
- Filtros de produtos e fornecedores e visualização clicável das curvas ABC.
- Tabelas independentes de pedidos pendentes e em trânsito.
- Edição manual de quantidades e impressão de pedidos/relatórios de acompanhamento.
- Funcionamento offline, sem dependências de execução externas.

## Uso

Abra `index.html` em um navegador compatível. Para importar arquivos ERP, use os controles da própria aplicação e siga as instruções exibidas na interface. Não inclua relatórios reais, credenciais ou dados comerciais no Git.

## Desenvolvimento e validação

A branch padrão é `main`. Mudanças devem ser propostas por Pull Request; preserve o comportamento V19 e valide a aplicação antes de solicitar revisão. O GitHub Actions executa verificações básicas de estrutura HTML e sintaxe JavaScript embutida em cada Pull Request e push.

## Privacidade

Este repositório é privado. Ainda assim, mantenha dados operacionais e comerciais fora do controle de versão. O workflow de validação não publica nem implanta a aplicação.

Consulte [`docs/arquitetura.md`](docs/arquitetura.md), [`docs/regras-de-negocio.md`](docs/regras-de-negocio.md) e [`docs/historico-versoes.md`](docs/historico-versoes.md).
