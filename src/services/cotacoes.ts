import { getSupabase, supabaseConfigurado } from '@/lib/supabase/cliente';

/**
 * Busca cotações, seja qual for a hospedagem.
 *
 * 1. Edge Function `cotacoes` no Supabase — é o que funciona no GitHub Pages,
 *    onde não há servidor Next. O token da brapi fica como secret lá.
 * 2. Rota /api/cotacoes do Next — usada ao rodar localmente (`npm run dev`)
 *    ou numa hospedagem com Node, caso a função ainda não tenha sido publicada.
 */

export interface RespostaCotacoes {
  atualizadoEm?: string;
  avisos: string[];
  cotacoes: { ticker: string; preco: number; variacao: number | null; fonte: string }[];
}

async function viaSupabase(tickers: string[]): Promise<RespostaCotacoes> {
  const { data, error } = await getSupabase().functions.invoke<RespostaCotacoes>('cotacoes', {
    body: { tickers },
  });
  if (error) throw error;
  if (!data?.cotacoes) throw new Error('Resposta inesperada da função de cotações.');
  return data;
}

async function viaRotaNext(tickers: string[]): Promise<RespostaCotacoes> {
  const resposta = await fetch(`/api/cotacoes?tickers=${encodeURIComponent(tickers.join(','))}`);
  if (resposta.status === 404) {
    throw new Error(
      'A função "cotacoes" ainda não foi publicada no Supabase. Publique-a (veja docs/COTACOES.md) para atualizar os preços pelo site.',
    );
  }
  if (!resposta.ok) throw new Error(`API respondeu ${resposta.status}`);
  return (await resposta.json()) as RespostaCotacoes;
}

export async function buscarCotacoes(tickers: string[]): Promise<RespostaCotacoes> {
  if (supabaseConfigurado) {
    try {
      return await viaSupabase(tickers);
    } catch (erro) {
      // Função não publicada (ou fora do ar): tenta a rota do Next antes de desistir.
      try {
        return await viaRotaNext(tickers);
      } catch {
        throw erro instanceof Error && !/non-2xx|Failed to send/i.test(erro.message)
          ? erro
          : new Error(
              'A função "cotacoes" não respondeu. Confira se ela foi publicada no Supabase (veja docs/COTACOES.md).',
            );
      }
    }
  }
  return viaRotaNext(tickers);
}
