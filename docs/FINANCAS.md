# Regras de negócio

Todas as funções descritas aqui estão em `src/lib/financas.ts` e são puras.

## Saldo de conta

```
saldo = saldoInicial
      + receitas pagas na conta
      − despesas pagas na conta
      + transferências recebidas
      − transferências enviadas
```

Duas regras que mudam o resultado:

**Só entra o que tem status `pago`.** Um boleto lançado mas não pago ainda não saiu do bolso. Ele
aparece em "próximos vencimentos", não no saldo.

**Compras no cartão de crédito não debitam a conta.** Elas ficam na fatura. Se contássemos as duas
coisas, o gasto apareceria duas vezes.

## Patrimônio líquido

```
patrimônio = saldo das contas marcadas "somar ao patrimônio"
           + carteira a preço de mercado
           − dívidas em aberto
```

Dívidas com `status === 'quitada'` saem da conta. Contas com `incluirNoPatrimonio: false` também —
serve para conta compartilhada ou de terceiro.

## Fatura de cartão

A janela da fatura vai do fechamento anterior (exclusivo) ao fechamento da competência (inclusivo):

```
fechamentoAnterior < data da compra ≤ fechamento
```

O vencimento cai no mês seguinte quando o dia de vencimento é anterior ao de fechamento — é o caso
comum: fecha dia 28, vence dia 5.

**Limite comprometido** conta tudo que ainda não foi pago, incluindo parcelas de meses futuros. É
maior que a fatura do mês, e é o número que importa para saber quanto ainda dá para gastar.

## Contas variáveis

`mediaDaVariavel()` olha as últimas N ocorrências (padrão 6) daquela recorrência e devolve média,
último valor e desvio percentual.

O alerta dispara quando o desvio passa de **+25%** e há pelo menos **3 amostras**. O piso de amostras
evita o falso positivo do segundo mês, quando qualquer variação parece enorme.

## Simulação de quitação (Tabela Price)

`simularQuitacao(divida, parcela)` roda mês a mês:

```
juros        = saldo × taxa
pagamento    = min(parcela, saldo + juros)
amortização  = pagamento − juros
saldo        = saldo − amortização
```

**Retorna `null` se a parcela não cobrir os juros do mês.** Esse é o caso em que a dívida cresce para
sempre, e a interface precisa dizer isso em vez de mostrar um cronograma de 600 meses. É a armadilha
real do rotativo do cartão.

Quando há acordo negociado (`valorAcordo`), o cálculo usa o valor do acordo, não o saldo cheio.

### Parcela para um prazo

Fórmula da Price, invertida:

```
parcela = saldo × i × (1+i)^n / ((1+i)^n − 1)
```

Com `i = 0`, cai no caso trivial `saldo / n`.

### Custo de não fazer nada

`custoSeManter()` é a régua contra a qual a economia é medida. Com parcelamento definido, é
`parcela × parcelas restantes`. Sem, é o saldo projetado com juros compostos por 12 meses.

## Ordem de pagamento das dívidas

`planoDeQuitacao(dividas, orçamento, estratégia)` simula mês a mês: paga o mínimo de todas e joga a
sobra na dívida da vez.

**Avalanche** ordena por maior juros. É matematicamente mais barato — você paga menos juros no total.

**Bola de neve** ordena por menor saldo. Custa um pouco mais, mas entrega vitórias rápidas. A
literatura de finanças comportamentais sugere que mais gente termina o plano assim, e um plano
terminado vale mais que um plano ótimo abandonado.

A função retorna `viavel: false` quando o orçamento não cobre nem os mínimos, junto com o valor
mínimo necessário — porque nesse cenário nenhuma estratégia funciona e a resposta certa é renegociar,
não escolher melhor.

Mínimo presumido quando a dívida não tem parcela definida: `max(3% do saldo, R$ 50)`.

## Metas

```
aporte mensal = (valorAlvo − valorAtual) / meses até o prazo
```

Com o prazo vencido e valor faltando, a meta é marcada como atrasada e o aporte devolve o valor
integral em vez de dividir por zero.

## Rentabilidade da carteira

```
mercado        = Σ quantidade × preço atual
custo          = Σ quantidade × preço médio
lucro          = mercado − custo
rentabilidade  = lucro / custo
proventos 12m  = Σ quantidade × preço atual × (DY / 100)
```

Sem preço atual, o preço médio é usado — a posição entra pelo custo e a rentabilidade fica em zero,
que é honesto para um ativo cuja cotação ainda não foi buscada.

Os proventos são uma **projeção** pelo dividend yield informado, não histórico realizado.

## Insights

`lib/insights.ts` tem 12 regras. Todas seguem o mesmo padrão: número concreto no título, contexto no
detalhe, link de ação quando existe um lugar para agir.

| Regra                    | Dispara quando                                    |
| ------------------------ | ------------------------------------------------- |
| Saldo negativo           | despesas > receitas no mês                        |
| Boa economia             | taxa de economia ≥ 20%                            |
| Despesa subiu            | +15% sobre o mês anterior                         |
| Estouro de orçamento     | gasto na categoria > teto definido                |
| Conta variável fora      | +25% sobre a média, com ≥ 3 amostras              |
| Vencimentos              | contas a pagar nos próximos 7 dias                |
| Atrasados                | despesa pendente com data passada                 |
| Limite comprometido      | ≥ 70% do limite do cartão                         |
| Fatura próxima           | vence em até 5 dias                               |
| Peso das assinaturas     | > 8% da renda mensal                              |
| Dívida cara              | juros ≥ 8% ao mês                                 |
| Reserva curta            | contas cobrem < 3 meses de despesa média          |
| Meta em risco            | prazo vencido, ou < 3 meses e progresso < 60%     |

Ordenação: crítico → atenção → neutro → positivo.

Os limiares são constantes no arquivo. Se virarem configuráveis por usuário, o lugar natural é
`perfil` no store.
