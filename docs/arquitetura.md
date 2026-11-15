# Arquitetura

## Aplicação

A V19 é distribuída como uma aplicação HTML autocontida, executada localmente pelo navegador. `index.html` é a cópia do artefato original `JBS_REPOSICAO_OFFLINE_CPD_IMPRESSAO_V19.html`; os scripts e estilos existentes permanecem no próprio arquivo. Não foi introduzida cadeia de build nem dependência externa.

## Fluxo de uso

1. O operador abre a página localmente.
2. Importa os relatórios ERP pelos controles implementados na aplicação.
3. Consulta sugestões de reposição, filtros de produto/fornecedor e curvas ABC.
4. Acompanha pedidos pendentes e em trânsito em tabela separada, ajusta quantidades e imprime os documentos necessários.

## Repositório e CI

`main` é a branch padrão. Alterações devem passar por Pull Request. O workflow `validate.yml` verifica presença e estrutura HTML básica e valida sintaxe de scripts inline com Node.js. O workflow não executa deploy. Dados ERP e demais dados comerciais não devem ser versionados.

## Limites documentais

Esta descrição reflete o artefato recebido; detalhes internos de persistência, formatos ERP e regras algorítmicas devem ser confirmados no código e com responsáveis funcionais antes de mudanças.
