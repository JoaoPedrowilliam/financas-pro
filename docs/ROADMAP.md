# O que não foi feito

Lista honesta do que ficou de fora e por onde continuar. Nada aqui é bloqueado pela arquitetura
atual.

## Fundamental para uso real

**Autenticação e persistência no servidor.** Detalhado em `SEGURANCA.md`. É o item que separa
protótipo de produto.

**Testes.** Não há nenhum. As funções de `lib/financas.ts` são puras e triviais de testar — comece
por elas, com Vitest. Casos que valem cobertura desde o primeiro dia:

- `gerarParcelas` — o resto dos centavos na primeira parcela
- `diaSeguro` — dia 31 em fevereiro, ano bissexto
- `simularQuitacao` — parcela abaixo dos juros deve devolver `null`
- `faturaDoCartao` — compra no dia do fechamento e no dia seguinte
- `planoDeQuitacao` — orçamento abaixo dos mínimos
- `saldoDaConta` — transferência entre contas não pode criar nem destruir dinheiro

**Importação de OFX/CSV do banco.** Digitar lançamento a lançamento é a maior barreira de adoção de
qualquer app de finanças. Um parser de OFX resolveria mais para o usuário do que qualquer tela nova.

## Melhorias de produto

**Categorização automática.** Com histórico suficiente, sugerir a categoria a partir da descrição.
Começa simples: memorizar a última categoria usada para cada descrição repetida.

**Orçamento por envelope.** Hoje o teto é por categoria e o aviso é retroativo. Um modo de envelope
mostraria o saldo restante antes do gasto.

**Projeção de fluxo de caixa.** Já existem os dados: recorrências, parcelas futuras e assinaturas.
Falta a tela que projeta o saldo dos próximos meses e avisa em que dia ele fica negativo.

**Metas alimentadas por conta.** O campo `contaId` existe em `Meta` mas não é usado — vincular a meta
a uma conta faria o progresso atualizar sozinho.

**Multi-moeda de verdade.** O seletor existe em Configurações, mas só o pt-BR/BRL está implementado.
`lib/format.ts` é o único arquivo a mudar.

**Histórico de cotações.** Hoje só o preço atual é guardado. Sem série histórica não dá para mostrar
a evolução da carteira ao longo do tempo — provavelmente o gráfico mais pedido do módulo.

## Técnico

**Virtualização da lista de lançamentos.** Acima de uns 2.000 itens a tabela começa a pesar.
`@tanstack/react-virtual` resolve.

**PWA.** Um app de finanças pessoais é candidato natural a instalável e offline-first.

**Testes de acessibilidade automatizados.** `axe-core` no CI para evitar regressão.

**Storybook.** As primitivas de `components/ui/` são estáveis e se beneficiariam de documentação
visual.

## O que foi deliberadamente deixado de fora

**Open Finance.** Exige homologação junto ao Banco Central e uma estrutura de segurança
incompatível com a versão atual. É um projeto próprio, não uma feature.

**Consulta automática de score e negativação.** Serasa e SPC não oferecem API pública para pessoa
física. Os campos de negativação são preenchidos manualmente por isso.

**Conselho de investimento.** O sistema mostra o que você tem e quanto rendeu. Recomendar alocação
exige registro na CVM.
