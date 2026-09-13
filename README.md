# Finanças Pro

Aplicação web de finanças pessoais: lançamentos, contas fixas e variáveis, cartões e faturas,
carteira de investimentos, metas e um plano de quitação de dívidas.

Next.js 16 · React 19 · TypeScript · Tailwind CSS · Radix UI · Framer Motion · Recharts · Zustand

---

## Começando

```bash
npm install
cp .env.example .env.local   # opcional, só para cotações reais
npm run dev
```

Abra <http://localhost:3000>. Na primeira visita, uma carteira de exemplo com seis meses de
histórico é carregada para você explorar o sistema. Em **Configurações → Dados e backup** há o
botão para apagar tudo e começar do zero.

> **O build baixa fontes do Google.** `next/font/google` busca Bricolage Grotesque e Inter em tempo
> de build e as auto-hospeda depois. Se sua máquina de build não tem acesso a `fonts.googleapis.com`,
> troque por `next/font/local` com os arquivos `.woff2` em `public/fonts/` — só o `src/app/layout.tsx`
> muda.

### Scripts

| Comando             | O que faz                              |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento            |
| `npm run build`     | Build de produção                      |
| `npm start`         | Sobe o build de produção               |
| `npm run typecheck` | `tsc --noEmit`, sem gerar arquivos     |

---

## ⚠️ Antes de usar com dados reais

Esta versão **não tem autenticação**. Não existe servidor, não existe verificação de senha, e todos
os dados ficam sem criptografia no `localStorage` do navegador. O PIN em Configurações é uma barreira
de interface — qualquer pessoa com acesso ao console do navegador lê os dados sem passar por ele.

O caminho para colocar isso no ar com segurança está em [`docs/SEGURANCA.md`](docs/SEGURANCA.md).

Consequência prática de guardar tudo no navegador: **limpar o histórico apaga seus dados.** Use
Configurações → Exportar backup com frequência.

---

## Como está organizado

```
src/
├── app/
│   ├── (app)/              Rotas com o shell (sidebar + topbar)
│   │   ├── dashboard/      Visão geral do mês
│   │   ├── financas/       Lançamentos + páginas mensais /financas/janeiro…
│   │   ├── contas/         Fixas, variáveis, vencimentos e contas bancárias
│   │   ├── cartoes/        Faturas, limites, parcelas futuras, assinaturas
│   │   ├── investimentos/  Carteira, cotações, alocação
│   │   ├── dividas/        Plano para limpar meu nome
│   │   ├── metas/          Objetivos e aportes
│   │   ├── relatorios/     Comparativos anuais, PDF e CSV
│   │   └── configuracoes/  Perfil, categorias, backup, segurança
│   ├── api/cotacoes/       Proxy de cotações (B3 e cripto)
│   └── login/              Tela de entrada
├── components/
│   ├── ui/                 Primitivas (padrão shadcn, escritas à mão sobre Radix)
│   ├── layout/             Sidebar, topbar, shell, tema
│   ├── shared/             Valor, CampoValor, cabeçalho, confirmação
│   └── <módulo>/           Componentes específicos de cada área
├── lib/
│   ├── financas.ts         Motor de cálculo — o coração do sistema
│   ├── insights.ts         Regras dos avisos automáticos
│   ├── exportar.ts         CSV, PDF e backup
│   ├── format.ts           Moeda, datas, percentuais em pt-BR
│   ├── sessao.ts           Sessão local (ver aviso acima)
│   └── utils.ts            Datas, agrupamento, `cn`
├── store/
│   ├── use-financas.ts     Store Zustand com persistência
│   └── seed.ts             Dados de demonstração
└── types/index.ts          Modelo de domínio
```

A documentação detalhada está em [`docs/`](docs/):

- [`ARQUITETURA.md`](docs/ARQUITETURA.md) — decisões técnicas e por que foram tomadas
- [`FINANCAS.md`](docs/FINANCAS.md) — as fórmulas, com as regras de negócio explicadas
- [`SEGURANCA.md`](docs/SEGURANCA.md) — o que falta para produção
- [`ROADMAP.md`](docs/ROADMAP.md) — o que não foi feito e como estender

---

## Cotações de investimentos

A rota `GET /api/cotacoes?tickers=PETR4,MXRF11,BTC` normaliza dois provedores:

- **B3** (ações, FIIs, ETFs, BDRs) via [brapi.dev](https://brapi.dev) — exige `BRAPI_TOKEN`
- **Cripto** via [CoinGecko](https://coingecko.com) — funciona sem chave

Sem `BRAPI_TOKEN`, os ativos da B3 vêm com preços **simulados** e a resposta traz um aviso. A
interface mostra isso no toast, então nunca há dúvida sobre a origem do número.

O proxy existe por três razões: a chave nunca chega ao navegador, a resposta é normalizada entre
provedores, e há um lugar único para colocar cache e rate limit.

---

## Convenções que valem em todo o código

**Dinheiro é `number`, sempre.** Nunca string. Arredondamento centralizado em `arredondar()`.

**Datas são `string` no formato `YYYY-MM-DD`.** Sem `Date` cru e sem UTC — `dataDe()` monta a data no
fuso local. Isso evita o clássico bug do lançamento que "pula" um dia.

**Toda cifra passa pelo componente `<Valor>`.** É o que faz o modo "ocultar valores" funcionar sem
deixar um número escapar numa tela esquecida.

**Cálculo fica em `lib/`, nunca em componente.** Os componentes chamam funções puras. Isso mantém as
regras testáveis e evita a mesma conta escrita de dois jeitos em duas telas.

**Só lançamentos com status `pago` entram no saldo.** O que está pendente ainda não saiu do bolso.

**Compras no cartão de crédito não debitam a conta.** Elas entram na fatura, e a fatura é que debita.

---

## Acessibilidade

- Navegação completa por teclado; foco sempre visível
- `prefers-reduced-motion` desliga toda animação
- Skip link para o conteúdo
- `aria-label` em todo controle sem texto; `role="alert"` nas mensagens de erro
- Contraste verificado nos dois temas
- Números com `font-variant-numeric: tabular-nums` — colunas de valores alinham

## Publicando

O projeto sai de fábrica pronto para dois destinos, escolhidos por variável de ambiente.
Nada precisa ser alterado no código para trocar de um para o outro.

### GitHub Pages (site estático)

Já existe o workflow `.github/workflows/deploy-pages.yml`. A cada push na `main` ele compila
e publica sozinho. Para ligar, uma vez só:

1. No repositório, vá em **Settings → Pages**
2. Em **Source**, escolha **GitHub Actions**

O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

O `BASE_PATH` é lido do nome do repositório pelo próprio workflow, então renomear o repositório
não quebra o build.

**O que muda nesse modo:** o GitHub Pages só serve arquivos, sem Node rodando. A rota
`/api/cotacoes` é removida antes de compilar e o botão "Atualizar cotações" passa a explicar
isso em vez de falhar. Todo o resto funciona igual — os dados vivem no navegador de quem acessa.

### Vercel (aplicação completa)

Importe o repositório em [vercel.com/new](https://vercel.com/new). Não há nada para configurar:
sem `EXPORT_ESTATICO`, o build é o padrão do Next e a rota de cotações existe normalmente.

Para cotações reais da B3, adicione `BRAPI_TOKEN` nas variáveis de ambiente do projeto. Sem ela,
a API responde em modo simulado e a interface continua funcionando.

### Rodando o build estático localmente

```bash
rm -rf src/app/api          # a rota não sobrevive ao export
EXPORT_ESTATICO=1 BASE_PATH=/NOME-DO-REPO npm run build
```

A saída fica em `out/`. Lembre de restaurar `src/app/api` depois (`git checkout src/app/api`).

---

## Licença

Uso livre.
