# Histórico de versões

## V23 — layout responsivo do PainelPedidos

- [PR #5](https://github.com/jottacostta/PainelPedidos/pull/5), commit `bfb64d2`. Reorganizou a importação, as sugestões, a revisão de produtos e os painéis recolhíveis para desktop e celular.

### Atualizações posteriores no ciclo V23

| PR | Mudança |
| --- | --- |
| [#6](https://github.com/jottacostta/PainelPedidos/pull/6) e [#7](https://github.com/jottacostta/PainelPedidos/pull/7) | Filtros operacionais abertos inicialmente e ordem original das colunas restaurada. |
| [#8](https://github.com/jottacostta/PainelPedidos/pull/8) a [#10](https://github.com/jottacostta/PainelPedidos/pull/10) | Bloqueio de pedidos com ruptura no CD, leitura da embalagem do ERP e nome ERP ESTATÍSTICA na interface. |
| [#11](https://github.com/jottacostta/PainelPedidos/pull/11) e [#15](https://github.com/jottacostta/PainelPedidos/pull/15) | Curva ABC pelo volume vendido em caixas, recalculada no grupo selecionado por filtro operacional ou fornecedor. |
| [#12](https://github.com/jottacostta/PainelPedidos/pull/12) e [#14](https://github.com/jottacostta/PainelPedidos/pull/14) | Detalhamento de pedidos negativos e estimativa de dias de venda do excedente. |
| [#13](https://github.com/jottacostta/PainelPedidos/pull/13) | Classificação de pastas por semelhança com o MIX. |
| [#17](https://github.com/jottacostta/PainelPedidos/pull/17) | Exposição e pulmão calculados pela venda média diária × 2, em substituição à consulta à base PART GON. |

## Versões anteriores

- **V22** — layout profissional e testes de regressão com Chromium, integrados pela [PR #4](https://github.com/jottacostta/PainelPedidos/pull/4).
- **V21** — grade desktop em largura total, na [PR #2](https://github.com/jottacostta/PainelPedidos/pull/2).
- **V20** — ajuste da distribuição do layout desktop, na [PR #1](https://github.com/jottacostta/PainelPedidos/pull/1).

## V19 — versão-base inicial deste repositório

- Incorporado como `index.html` o arquivo original `JBS_REPOSICAO_OFFLINE_CPD_IMPRESSAO_V19.html` fornecido para esta tarefa.
- Criada documentação inicial da arquitetura e das regras conhecidas.
- Configurada validação básica automatizada via GitHub Actions.
- Sem deploy e sem dependências de aplicação adicionadas.
