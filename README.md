# PainelPedidos — JBS Reposição V23

Painel web offline para revisar o estoque, calcular a reposição e preparar pedidos para o CPD. A V23 é a versão numerada do layout incorporada pela [PR #5](https://github.com/jottacostta/PainelPedidos/pull/5). As melhorias posteriores estão no [histórico de versões](docs/historico-versoes.md).

Para usar sem internet, toque no **G** do cabeçalho. O navegador baixa `PainelPedidos-offline.html`, uma cópia completa do painel com as bases embutidas, que abre direto do arquivo.

## Como usar

1. Abra `index.html` em um navegador com suporte à descompressão gzip por `DecompressionStream`, como o Chromium.
2. Importe o **ERP ESTATÍSTICA** com os campos **001, 002, 003, 049, 052, 153, 154 e 164**. Os campos 002 e 049 são obrigatórios. Os demais podem faltar no arquivo ou ser desmarcados no painel **Campos do ERP ESTATÍSTICA**. A importação aceita `.xls`, `.txt` e `.tsv` com conteúdo tabulado e reconhece o relatório pelo cabeçalho.
3. Confira a cobertura cadastral, ajuste os filtros e revise a coluna **Alertas**. Se necessário, ajuste o **Pedido Final** antes de gerar as sugestões.
4. Gere as sugestões para imprimir o pedido do CPD. Use **Acompanhamento de pedidos** para consultar e imprimir pendências e trânsito.
5. Para continuar em outra sessão, baixe o backup JSON e restaure-o ao reabrir o painel. Ajustes manuais do pedido valem para a sessão atual.

## Desenvolvimento e testes

A branch padrão é `main`. Abra uma pull request para propor alterações. O GitHub Actions valida a estrutura do HTML, a sintaxe do JavaScript e os fluxos do painel com Playwright e Chromium.

Para executar os testes localmente, use Node.js 20, npm e Python 3 na raiz do repositório.

```sh
npm install --no-save playwright@1.56.1
npx playwright install chromium
python3 -m http.server 8765 --bind 127.0.0.1
```

Rode a suíte em outro terminal enquanto o servidor estiver em execução.

```sh
node tests/smoke.cjs
```

Use dados sintéticos nos testes. Mantenha relatórios operacionais, backups e pedidos reais fora do Git. O workflow é de validação e a aplicação pode ser aberta diretamente do arquivo HTML.

- [Arquitetura](docs/arquitetura.md)
- [Regras de negócio](docs/regras-de-negocio.md)
- [Histórico de versões](docs/historico-versoes.md)
