# Regras de negócio

## Importação e cadastro

- A quantidade de unidades por caixa vem da embalagem que aparece nos campos de pedido pendente ou trânsito do ERP ESTATÍSTICA, no formato `caixas x unidades por caixa + unidades avulsas`. Se as duas embalagens informadas divergirem ou se nenhuma for válida, o painel sinaliza o cadastro.
- Se o item estiver sem pasta, o painel procura o mesmo prefixo de duas palavras da descrição no MIX. A classificação por semelhança exige pelo menos três cadastros de referência e concordância entre suas pastas.

## Curva ABC e cobertura

- A curva usa o volume vendido em caixas, calculado dividindo as unidades vendidas pela quantidade por caixa. Os HOSTs são ordenados do maior para o menor volume. A curva A preenche o acumulado até o corte de 80%, e a B até 95%. O item que alcança ou ultrapassa um corte fica na classe que estava sendo preenchida. A curva C reúne o restante.
- Ao aplicar filtro operacional ou de fornecedor, a classificação e as quantidades são recalculadas dentro desse grupo. Os botões A, B e C exibem os respectivos subconjuntos. A busca textual restringe os resultados exibidos.
- A cobertura padrão é de 7 dias para A, 10 para B e 14 para C, considerando um período de vendas de 30 dias. Os quatro parâmetros podem ser ajustados no painel.

## Reposição e acompanhamento

### Pedido final automático

1. Venda média diária em caixas = unidades vendidas ÷ unidades por caixa ÷ dias de venda.
2. Cobertura ABC em caixas = venda média diária × dias da curva.
3. Exposição e pulmão em caixas = venda média diária × 2. Um dia abastece a gôndola e o outro fica como reserva no depósito da loja. Esse cálculo substitui a consulta à base PART GON.
4. Pedido bruto em caixas = cobertura ABC + exposição e pulmão − estoque da loja em caixas − pendências − trânsito.

Para um item A com 360 unidades vendidas em 30 dias e 12 unidades por caixa, a média é de 1 caixa por dia. Com 36 unidades na loja, 1 caixa pendente e 2 em trânsito, o pedido final é **7 + 2 − 3 − 1 − 2 = 3 caixas**.

O painel arredonda resultados positivos para cima e negativos para baixo. Ao restaurar um backup antigo, recalcula a parcela de exposição e pulmão com o período de vendas restaurado.

### Regras operacionais

- Estoque do CD zerado gera a situação **RUPTURA CD**, com pedido final e sugestão zerados. A edição fica indisponível nessa situação.
- O pedido considera necessidade de cobertura e área de venda, estoque da loja, pendências e trânsito. Quando o cálculo é negativo, a coluna **Alertas** detalha esses componentes e estima quantos dias de venda o excedente representa, desde que exista média de venda positiva. A sugestão de reposição é zero nesse caso.
- O operador pode ajustar manualmente o pedido com uma quantidade inteira de caixas igual ou maior que zero. Gere as sugestões depois do ajuste para atualizar o pedido impresso.
- O acompanhamento reúne itens com pendência ou trânsito acima de zero, mostra totais em caixas e tem impressão própria. O CSV exporta a revisão de produtos conforme os filtros ativos.
