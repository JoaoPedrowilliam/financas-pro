# Arquitetura

## Visão geral

Aplicação client-heavy sobre o App Router. Quase tudo é client component, porque quase tudo depende
de um estado que vive no navegador. As exceções são o layout raiz, a rota `/financas/[mes]` (que só
resolve parâmetros) e a rota de API de cotações.

```
Navegador
  └─ Zustand + persist ──► localStorage
        │
        ├─ lib/financas.ts   (funções puras de cálculo)
        ├─ lib/insights.ts   (regras dos avisos)
        └─ lib/exportar.ts   (CSV, PDF, backup)

Servidor Next
  └─ /api/cotacoes ──► brapi.dev (B3) + CoinGecko (cripto)
```

## Por que Zustand e não Context

O estado financeiro é grande e muda com frequência. Com Context, qualquer alteração numa lista
re-renderiza toda a árvore abaixo do provider. Zustand permite selecionar fatias:

```ts
const oculto = useFinancas((s) => s.perfil.ocultarValores);
```

Esse componente só re-renderiza quando `ocultarValores` muda — não quando um lançamento é criado.

O middleware `persist` cuida de serializar para `localStorage` e reidratar na volta. O
`onRehydrateStorage` faz duas coisas na abertura: carrega os dados de exemplo se estiver tudo vazio,
e gera os lançamentos recorrentes do mês corrente.

### Por que `hidratado`

Enquanto o `localStorage` não foi lido, o estado é o inicial vazio. Renderizar nesse intervalo mostra
"R$ 0,00" por um instante e depois o valor real — um flash desagradável e um erro de hidratação. A
flag `hidratado` faz o `AppShell` segurar um esqueleto até os dados chegarem.

## Camadas

**`types/`** define o domínio. Todo o resto deriva daqui.

**`lib/`** contém funções puras. Nenhuma toca em React, nenhuma faz I/O. Isso significa que dá para
testá-las sem montar componente, e que a mesma regra nunca é reescrita em duas telas.

**`store/`** é a única coisa que muda estado. As ações são pequenas e nomeadas pelo que fazem no
domínio (`registrarPagamento`, `aportarNaMeta`), não por operação de banco (`update`, `patch`).

**`components/ui/`** são primitivas sem conhecimento do domínio. Foram escritas à mão sobre Radix em
vez de instaladas via CLI do shadcn, para que os tokens de cor (`cedula`, `coral`, `aco`) valham em
todos os componentes sem sobrescrita.

**`components/<módulo>/`** conhecem o domínio e chamam o store.

## Decisões que valem explicação

### Datas como string ISO, nunca `Date`

`new Date('2026-03-10')` é interpretado como UTC. Em fusos negativos, isso vira 9 de março às 21h — e
o lançamento aparece no dia errado. Todas as datas do sistema são `string` no formato `YYYY-MM-DD`, e
`dataDe()` monta o `Date` local explicitamente:

```ts
const [a, m, d] = iso.split('-').map(Number);
return new Date(a, m - 1, d);
```

Bônus: comparar competências e ordenar por data vira comparação de string, que é mais rápida e não
tem armadilha de fuso.

### `diaSeguro()` para vencimentos

Uma conta que vence dia 31 não existe em fevereiro. `diaSeguro(ano, mes, dia)` corta o dia para o
último do mês. Sem isso, `new Date(2026, 1, 31)` silenciosamente vira 3 de março.

### Parcelamento gera N lançamentos

Uma compra em 10x vira dez lançamentos ligados por um `grupoId`, cada um com sua data. A alternativa
— um lançamento com campo "parcelas" — quebraria o fluxo de caixa mensal, porque o mês em que a
compra foi feita não é o mês em que o dinheiro sai.

O resto dos centavos vai na primeira parcela, como fazem as operadoras: R$ 100 em 3x é
R$ 33,34 + R$ 33,33 + R$ 33,33.

### Recorrências são idempotentes

`gerarLancamentosDoMes(comp)` pode ser chamada quantas vezes for: ela verifica se já existe um
lançamento com aquele `recorrenciaId` naquela competência antes de criar. Isso importa porque a
função roda na abertura do app, e ninguém quer o aluguel lançado três vezes por ter aberto três abas.

Assinaturas usam a mesma lógica com uma etiqueta marcadora `assinatura:<id>`.

### Fatura respeita o fechamento

`faturaDoCartao()` não filtra por mês do calendário — filtra pela janela entre o fechamento anterior e
o fechamento da competência. Uma compra feita depois do fechamento cai na fatura seguinte, que é o
que o cartão faz de verdade.

### Import dinâmico do jspdf

`jspdf` + `jspdf-autotable` somam algo perto de 350 KB. Carregá-los no bundle inicial penaliza todo
mundo por um recurso que a maioria usa raramente. `lib/exportar.ts` importa sob demanda dentro da
função `gerarPDF()`.

## Renderização e rotas

`/financas/[mes]` é o único server component com lógica. No Next 16, `params` e `searchParams` são
Promises; a página as resolve, valida o slug e o ano, e passa números limpos para o componente
cliente. Slug inválido cai em `notFound()`.

O `?ano=` é validado contra um intervalo razoável — sem isso, `?ano=abc` viraria `NaN` e produziria
uma tela de datas inválidas.

## Estilo

Tokens em variáveis CSS HSL, dois temas na mesma escala. Os nomes descrevem função, não cor
(`--surface-raised`, `--ink-muted`), então trocar a paleta não exige tocar em componente.

`next-themes` com `attribute="class"` e `suppressHydrationWarning` no `<html>`: o tema é lido antes da
hidratação, e o atributo diverge do HTML servido por definição.

## O que falta para escalar

Nada aqui assume `localStorage` fora do store e do `lib/sessao.ts`. Trocar por uma API significa
reimplementar as ações do store como chamadas de rede — as funções de `lib/` e todos os componentes
continuam iguais. O passo a passo está em `SEGURANCA.md`.
