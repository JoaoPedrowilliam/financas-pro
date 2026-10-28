import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cotacoes?tickers=PETR4,MXRF11,BTC
 *
 * Fica entre o cliente e os provedores externos por três motivos:
 * 1. a chave da brapi nunca chega ao navegador;
 * 2. a resposta é normalizada (ação, FII e cripto viram o mesmo formato);
 * 3. dá um ponto único para cache e rate limit.
 *
 * Sem BRAPI_TOKEN configurado, responde em modo simulado — a interface
 * continua funcionando numa demo sem credenciais.
 */

interface Cotacao {
  ticker: string;
  preco: number;
  variacao: number | null;
  dividendYield?: number;
  fonte: 'brapi' | 'coingecko' | 'simulado';
}

const CRIPTO: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDT: 'tether',
  ADA: 'cardano',
  XRP: 'ripple',
};

/** Plano gratuito da brapi: 1 ticker por chamada e 1 chamada simultânea. */
async function buscarB3(tickers: string[], token: string): Promise<Cotacao[]> {
  const cotacoes: Cotacao[] = [];
  for (const ticker of tickers) {
    const resposta = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    });
    if (!resposta.ok) continue;
    const json = (await resposta.json()) as {
      results?: { symbol: string; regularMarketPrice: number; regularMarketChangePercent: number }[];
    };
    const r = json.results?.[0];
    if (!r) continue;
    cotacoes.push({
      ticker: r.symbol.toUpperCase(),
      preco: r.regularMarketPrice,
      variacao: r.regularMarketChangePercent ?? null,
      fonte: 'brapi' as const,
    });
  }
  return cotacoes;
}

async function buscarCripto(tickers: string[]): Promise<Cotacao[]> {
  const ids = tickers.map((t) => CRIPTO[t]).filter(Boolean);
  if (!ids.length) return [];
  const base = process.env.COINGECKO_API_URL ?? 'https://api.coingecko.com/api/v3';
  const url = `${base}/simple/price?ids=${ids.join(',')}&vs_currencies=brl&include_24hr_change=true`;
  const resposta = await fetch(url, { next: { revalidate: 60 } });
  if (!resposta.ok) throw new Error(`coingecko respondeu ${resposta.status}`);
  const json = (await resposta.json()) as Record<string, { brl: number; brl_24h_change?: number }>;

  return tickers
    .filter((t) => CRIPTO[t] && json[CRIPTO[t]])
    .map((t) => ({
      ticker: t,
      preco: json[CRIPTO[t]].brl,
      variacao: json[CRIPTO[t]].brl_24h_change ?? null,
      fonte: 'coingecko' as const,
    }));
}

/** Oscilação determinística por ticker+dia: a demo não fica "piscando" a cada refresh.
 *  O `preco` aqui é um placeholder sem significado — o que vale é `variacao`,
 *  que o cliente aplica sobre o preço que já tem. Inventar um preço absoluto
 *  faria BTC valer menos que uma ação. */
function simular(ticker: string): Cotacao {
  const semente = `${ticker}-${new Date().toISOString().slice(0, 10)}`
    .split('')
    .reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100000, 7);
  const variacao = ((semente % 700) / 100 - 3.5);
  const base = 10 + (semente % 240);
  return {
    ticker,
    preco: Math.round(base * (1 + variacao / 100) * 100) / 100,
    variacao: Math.round(variacao * 100) / 100,
    fonte: 'simulado',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bruto = searchParams.get('tickers') ?? '';
  const tickers = Array.from(
    new Set(bruto.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)),
  ).slice(0, 40);

  if (!tickers.length) {
    return NextResponse.json(
      { erro: 'Informe ao menos um ticker em ?tickers=PETR4,MXRF11' },
      { status: 400 },
    );
  }

  const cripto = tickers.filter((t) => CRIPTO[t]);
  const bolsa = tickers.filter((t) => !CRIPTO[t] && /^[A-Z]{4}\d{1,2}$/.test(t));
  const outros = tickers.filter((t) => !cripto.includes(t) && !bolsa.includes(t));

  const token = process.env.BRAPI_TOKEN;
  const avisos: string[] = [];
  const cotacoes: Cotacao[] = [];

  const resultados = await Promise.allSettled([
    token && bolsa.length ? buscarB3(bolsa, token) : Promise.resolve<Cotacao[]>([]),
    cripto.length ? buscarCripto(cripto) : Promise.resolve<Cotacao[]>([]),
  ]);

  for (const r of resultados) {
    if (r.status === 'fulfilled') cotacoes.push(...r.value);
    else avisos.push(r.reason instanceof Error ? r.reason.message : 'falha ao consultar provedor');
  }

  if (!token && bolsa.length) {
    avisos.push('BRAPI_TOKEN não configurado — ativos da B3 vieram simulados.');
  }

  // Renda fixa e qualquer ticker sem provedor ficam simulados.
  const atendidos = new Set(cotacoes.map((c) => c.ticker));
  for (const t of [...bolsa, ...cripto, ...outros]) {
    if (!atendidos.has(t)) cotacoes.push(simular(t));
  }

  return NextResponse.json({
    atualizadoEm: new Date().toISOString(),
    avisos,
    cotacoes,
  });
}
