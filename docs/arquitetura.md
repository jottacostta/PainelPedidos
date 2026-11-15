# Arquitetura

## Aplicação

O `index.html` reúne a interface, os estilos, o JavaScript e as bases iniciais MIX e PART GON em um único arquivo. Na abertura, o navegador descomprime as bases internas. A importação, os cálculos e a preparação dos arquivos para exportação e impressão acontecem no próprio dispositivo.

O ERP ESTATÍSTICA é lido como texto tabulado, decodificado em Windows-1252. O cabeçalho identifica o formato. O painel cruza os itens do ERP com MIX e PART GON pelo código HOST. A matriz opcional é um JSON com uma lista de códigos e alimenta o filtro de matriz. Para substituir as bases da sessão, importe um JSON com os arrays `mix` e `part` e reimporte o ERP.

## Sessão e backup

Ao abrir o painel, os produtos processados começam vazios. O backup JSON guarda produtos processados, parâmetros de cobertura e códigos da matriz. Ao restaurar o arquivo, o painel recalcula os pedidos com os parâmetros restaurados. Para reconstruir a curva ABC geral a partir das vendas, reimporte o ERP original. Edições manuais de pedido e seleções de filtro são mantidas em memória durante a sessão.

## Validação

O workflow [Validate](../.github/workflows/validate.yml) roda em pull requests para `main` e em pushes nessa branch. Ele verifica HTML e sintaxe JavaScript e executa a suíte [smoke.cjs](../tests/smoke.cjs) em Chromium. A suíte usa relatórios e backups sintéticos e verifica a interface em larguras de 320, 390, 768, 1366 e 1920 px.
