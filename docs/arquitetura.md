# Arquitetura

## Aplicação

O `index.html` reúne a interface, os estilos, o JavaScript e a base inicial MIX em um único arquivo. Na abertura, o navegador descomprime a base interna. A importação, os cálculos e a preparação dos arquivos para exportação e impressão acontecem no próprio dispositivo.

O ERP ESTATÍSTICA é lido como texto tabulado, decodificado em Windows-1252. O cabeçalho identifica o formato, e cada coluna é localizada pelo nome, em qualquer ordem. São obrigatórias CHAVE, DESCRICAO, a quantidade vendida (002), o estoque em unidades (049) e ao menos uma coluna de pendente (153) ou trânsito (154), de onde vem a embalagem. Valor da venda (001), custo da venda (003), estoque a custo (052) e estoque do depósito (164) são opcionais. A seleção de campos fica em `config.campos` e acompanha o backup. O painel cruza os itens do ERP com o MIX pelo código HOST. A matriz opcional é um JSON com uma lista de códigos e alimenta o filtro de matriz. Para substituir a base da sessão, importe um JSON com o array `mix` e reimporte o ERP.

## Sessão e backup

Ao abrir o painel, os produtos processados começam vazios. O backup JSON guarda produtos processados, parâmetros de cobertura e códigos da matriz. Ao restaurar o arquivo, o painel recalcula os pedidos com os parâmetros restaurados. Para reconstruir a curva ABC geral a partir das vendas, reimporte o ERP original. Edições manuais de pedido e seleções de filtro são mantidas em memória durante a sessão.

## Validação

O workflow [Validate](../.github/workflows/validate.yml) roda em pull requests para `main` e em pushes nessa branch. Ele verifica HTML e sintaxe JavaScript e executa a suíte [smoke.cjs](../tests/smoke.cjs) em Chromium. A suíte usa relatórios e backups sintéticos e verifica a interface em larguras de 320, 390, 768, 1366 e 1920 px.
