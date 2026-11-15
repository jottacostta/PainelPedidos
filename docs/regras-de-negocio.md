# Regras de negócio (escopo conhecido da V19)

- A aplicação permite importar relatórios provenientes do ERP para apoiar a reposição.
- São calculadas sugestões de reposição a partir dos dados processados pela aplicação. Parâmetros e fórmulas exatas permanecem definidos pelo código V19 e devem ser preservados.
- Produtos e fornecedores podem ser filtrados.
- As classes/curvas A, B e C são apresentadas como controles clicáveis para consulta segmentada.
- Pedidos pendentes e pedidos em trânsito são acompanhados em tabela independente.
- Quantidades podem ser editadas manualmente.
- Pedidos e relatórios de acompanhamento podem ser impressos.
- A solução deve continuar utilizável offline.

## Cuidados

Não inferir nem alterar limiares ABC, fórmulas de sugestão, critérios de estoque ou layouts de importação sem validação com o responsável do processo. Não registrar em commits relatórios ERP, pedidos reais ou informações comerciais.
