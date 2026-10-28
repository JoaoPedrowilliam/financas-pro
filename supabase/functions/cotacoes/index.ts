/**
 * Supabase Edge Function: cotacoes
 *
 * Faz no Supabase o mesmo papel da rota /api/cotacoes do Next, que não existe
 * na publicação estática do GitHub Pages:
 *  - a chave da brapi (BRAPI_TOKEN) fica guardada como secret do Supabase e
 *    nunca chega ao navegador;
 *  - ação, FII, ETF, BDR e cripto voltam no mesmo formato.
 *
 * Chamada pelo app com supabase.functions.invoke('cotacoes', { body: { tickers } }).
 * Como a verificação de JWT fica ligada (padrão), só usuário logado consegue usar.
 *
 * Plano gratuito da brapi: 1 ticker por chamada e 1 chamada simultânea, por
 * isso os ativos da B3 são consultados um de cada vez.
 */

interface Cotacao {
  ticker: string;
  preco: number;
  variacao: number | null;
  dividendYield?: number;
  fonte: 'brapi' | 'coingecko' | 'simulado';
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const CRIPTO: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  USDT: 'tether',
  ADA: 'cardano',
  XRP: 'ripple',
};

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function buscarB3(tickers: string[], token: string, avisos: string[]): Promise<Cotacao[]> {
  const cotacoes: Cotacao[] = [];
  for (const ticker of tickers) {
    try {
      const resposta = await fetch(
        `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resposta.ok) {
        avisos.push(`brapi respondeu ${resposta.status} para ${ticker}`);
        continue;
      }
      const dados = (await resposta.json()) as {
        results?: { symbol: string; regularMarketPrice: number; regularMarketChangePercent?: number }[];
      };
      const r = dados.results?.[0];
      if (r && typeof r.regularMarketPrice === 'number') {
        cotacoes.push({
          ticker: r.symbol.toUpperCase(),
          preco: r.regularMarketPrice,
          variacao: r.regularMarketChangePercent ?? null,
          fonte: 'brapi',
        });
      }
    } catch (erro) {
      avisos.push(`falha ao consultar ${ticker}: ${erro instanceof Error ? erro.message : erro}`);
    }
  }
  return cotacoes;
}

async function buscarCripto(tickers: string[]): Promise<Cotacao[]> {
  const ids = tickers.map((t) => CRIPTO[t]).filter(Boolean);
  if (!ids.length) return [];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=brl&include_24hr_change=true`;
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`coingecko respondeu ${resposta.status}`);
  const dados = (await resposta.json()) as Record<string, { brl: number; brl_24h_change?: number }>;
  return tickers
    .filter((t) => CRIPTO[t] && dados[CRIPTO[t]])
    .map((t) => ({
      ticker: t,
      preco: dados[CRIPTO[t]].brl,
      variacao: dados[CRIPTO[t]].brl_24h_change ?? null,
      fonte: 'coingecko' as const,
    }));
}

/** Mesmo critério da rota do Next: oscilação determinística por ticker+dia.
 *  O app aplica só a `variacao` sobre o preço que já tem. */
function simular(ticker: string): Cotacao {
  const semente = `${ticker}-${new Date().toISOString().slice(0, 10)}`
    .split('')
    .reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100000, 7);
  const variacao = (semente % 700) / 100 - 3.5;
  const base = 10 + (semente % 240);
  return {
    ticker,
    preco: Math.round(base * (1 + variacao / 100) * 100) / 100,
    variacao: Math.round(variacao * 100) / 100,
    fonte: 'simulado',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let bruto: string[] = [];
  if (req.method === 'POST') {
    const corpo = await req.json().catch(() => ({}));
    const t = (corpo as { tickers?: unknown }).tickers;
    bruto = Array.isArray(t) ? t.map(String) : typeof t === 'string' ? t.split(',') : [];
  } else {
    bruto = (new URL(req.url).searchParams.get('tickers') ?? '').split(',');
  }

  const tickers = Array.from(
    new Set(bruto.map((t) => t.trim().toUpperCase()).filter(Boolean)),
  ).slice(0, 40);

  if (!tickers.length) {
    return json({ erro: 'Informe ao menos um ticker, ex.: { "tickers": ["PETR4", "MXRF11"] }' }, 400);
  }

  const cripto = tickers.filter((t) => CRIPTO[t]);
  const bolsa = tickers.filter((t) => !CRIPTO[t] && /^[A-Z]{4}\d{1,2}$/.test(t));
  const outros = tickers.filter((t) => !cripto.includes(t) && !bolsa.includes(t));

  const token = Deno.env.get('BRAPI_TOKEN');
  const avisos: string[] = [];
  const cotacoes: Cotacao[] = [];

  const resultados = await Promise.allSettled([
    token && bolsa.length ? buscarB3(bolsa, token, avisos) : Promise.resolve<Cotacao[]>([]),
    cripto.length ? buscarCripto(cripto) : Promise.resolve<Cotacao[]>([]),
  ]);
  for (const r of resultados) {
    if (r.status === 'fulfilled') cotacoes.push(...r.value);
    else avisos.push(r.reason instanceof Error ? r.reason.message : 'falha ao consultar provedor');
  }

  if (!token && bolsa.length) {
    avisos.push('BRAPI_TOKEN não configurado no Supabase — ativos da B3 vieram simulados.');
  }

  // Renda fixa e qualquer ticker sem provedor ficam simulados.
  const atendidos = new Set(cotacoes.map((c) => c.ticker));
  for (const t of [...bolsa, ...cripto, ...outros]) {
    if (!atendidos.has(t)) cotacoes.push(simular(t));
  }

  return json({ atualizadoEm: new Date().toISOString(), avisos, cotacoes });
});
