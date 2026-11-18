# Regras de negócio

## Importação e cadastro

- A quantidade de unidades por caixa vem da embalagem que aparece nos campos de pedido pendente ou trânsito do ERP ESTATÍSTICA, no formato `caixas x unidades por caixa + unidades avulsas`. Se as duas embalagens informadas divergirem ou se nenhuma for válida, o painel sinaliza o cadastro.
- Se o item estiver sem pasta, o painel procura o mesmo prefixo de duas palavras da descrição no MIX. A classificação por semelhança pode usar um único cadastro com pasta preenchida. Quando há referências em pastas diferentes, o item fica sem classificação automática.

## Campos do ERP ESTATÍSTICA

O painel **Campos do ERP ESTATÍSTICA** lista os campos do relatório com uma caixa de marcar. Um campo desmarcado ou ausente do arquivo deixa de entrar no cálculo, e a regra que depende dele é desligada.

| Campo | Marcado | Desmarcado ou ausente |
| --- | --- | --- |
| 001 · Valor Venda | Curva ABC por faturamento. Com o 003, calcula a margem. | Curva ABC por caixas vendidas. Sem margem. |
| 002 · Quantidade Vendida em Unidade | Obrigatório. | — |
| 003 · Custo Venda | Valor da caixa = custo da venda ÷ caixas vendidas. Com o 001, calcula a margem. | Valor da caixa do MIX. Sem margem. |
| 049 · Estoque em Unidade | Obrigatório. | — |
| 052 · Estoque a Custo com ICMS | Indicador **Estoque a custo** com a soma dos produtos exibidos, incluindo estoques negativos, como no total do ERP. | Indicador sem valor. |
| 153 · Pedidos Pendentes (CX) | Pendências descontadas do pedido. | Pendência considerada zero no pedido, no filtro DIRETO e no acompanhamento. |
| 154 · Estoque em Trânsito (CX) | Trânsito descontado do pedido. | Trânsito considerado zero no pedido e no acompanhamento. |
| 164 · Estoque Depósito (CX) | Regra RUPTURA CD e filtros que exigem estoque no CD. | Regra RUPTURA CD desligada. Filtros de pasta e CDS deixam de exigir estoque no CD. |

- Margem = (valor da venda − custo da venda) ÷ valor da venda. Margem negativa gera o alerta **MARGEM NEGATIVA**.
- Sem venda no período ou sem custo informado, o valor do pedido usa o valor da caixa do MIX. O CSV informa a origem em `ORIGEM_VALOR_CAIXA`.
- Mesmo com 153 e 154 desmarcados, a embalagem continua sendo lida dessas colunas.

## Curva ABC e cobertura

- Com o campo 001 marcado, a curva usa o valor vendido. Sem ele, usa o volume vendido em caixas, calculado dividindo as unidades vendidas pela quantidade por caixa. Os HOSTs são ordenados do maior para o menor volume. A curva A preenche o acumulado até o corte de 80%, e a B até 95%. O item que alcança ou ultrapassa um corte fica na classe que estava sendo preenchida. A curva C reúne o restante.
- Ao aplicar filtro operacional ou de fornecedor, a classificação e as quantidades são recalculadas dentro desse grupo. Os botões A, B e C exibem os respectivos subconjuntos. A busca textual restringe os resultados exibidos.
- A cobertura padrão é de 7 dias para A, 10 para B e 14 para C, considerando um período de vendas de 30 dias. Os quatro parâmetros podem ser ajustados no painel.

## Reposição e acompanhamento

### Pedido final automático

1. Venda média diária em caixas = unidades vendidas ÷ unidades por caixa ÷ dias de venda.
2. Cobertura ABC em caixas = venda média diária × dias da curva.
3. Exposição e pulmão em caixas = venda média diária × 2. Um dia abastece a gôndola e o outro fica como reserva no depósito da loja. Esse cálculo substitui a consulta à base PART GON.
4. Pedido bruto em caixas = cobertura ABC + exposição e pulmão − estoque da loja em caixas − pendências − trânsito. Pendências e trânsito entram só quando os campos 153 e 154 estão marcados.

Para um item A com 360 unidades vendidas em 30 dias e 12 unidades por caixa, a média é de 1 caixa por dia. Com 36 unidades na loja, 1 caixa pendente e 2 em trânsito, o pedido final é **7 + 2 − 3 − 1 − 2 = 3 caixas**.

O painel arredonda resultados positivos para cima e negativos para baixo. Ao restaurar um backup antigo, recalcula a parcela de exposição e pulmão com o período de vendas restaurado.

### Regras operacionais

- Estoque do CD zerado gera a situação **RUPTURA CD**, com pedido final e sugestão zerados. A edição fica indisponível nessa situação.
- O pedido considera necessidade de cobertura e área de venda, estoque da loja, pendências e trânsito. Quando o cálculo é negativo, a coluna **Alertas** detalha esses componentes e estima quantos dias de venda o excedente representa, desde que exista média de venda positiva. A sugestão de reposição é zero nesse caso.
- O operador pode ajustar manualmente o pedido com uma quantidade inteira de caixas igual ou maior que zero. Gere as sugestões depois do ajuste para atualizar o pedido impresso.
- O acompanhamento reúne itens com pendência ou trânsito acima de zero, mostra totais em caixas e tem impressão própria. O CSV exporta a revisão de produtos conforme os filtros ativos.
