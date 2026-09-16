import { getSupabase } from '@/lib/supabase/cliente';
import { criarServico, ErroDeDados } from './base';
import { ativoDeLinha, ativoParaLinha } from '@/lib/supabase/mapear';
import type { Ativo } from '@/types';

/**
 * Carteira de investimentos.
 *
 * Distinção que o banco precisa respeitar: a POSIÇÃO do usuário (ticker,
 * quantidade, preço médio) é dado persistente e dele. A COTAÇÃO é informação
 * externa e volátil, que vem de /api/cotacoes.
 *
 * `preco_atual` fica na mesma linha por conveniência de leitura, mas é cache:
 * a verdade de mercado está no provedor, não aqui. Por isso `aplicarCotacoes`
 * toca apenas esse campo e o carimbo de atualização — nunca quantidade nem
 * preço médio, que são o que a pessoa de fato comprou.
 */

const base = criarServico<Ativo>('ativos', ativoDeLinha, { coluna: 'ticker', crescente: true });

export const servicoAtivos = {
  ...base,

  /**
   * Atualiza só os preços, a partir do retorno da rota de cotações.
   * Um update por ativo: são poucos registros e cada um tem preço diferente,
   * então não há ganho real em montar um upsert em lote aqui.
   */
  async aplicarCotacoes(
    cotacoes: Record<string, { preco: number; dividendYield?: number }>,
    ativos: Ativo[],
  ): Promise<number> {
    const agora = new Date().toISOString();
    const sb = getSupabase();
    let atualizados = 0;

    for (const ativo of ativos) {
      const cotacao = cotacoes[ativo.ticker.toUpperCase()];
      if (!cotacao) continue;

      const { error } = await sb
        .from('ativos')
        .update({
          preco_atual: cotacao.preco,
          dividend_yield: cotacao.dividendYield ?? ativo.dividendYield ?? null,
          atualizado_cotacao_em: agora,
        })
        .eq('id', ativo.id);

      if (error) throw new ErroDeDados('ativos', 'aplicar cotação', error);
      atualizados += 1;
    }
    return atualizados;
  },
};

export { ativoParaLinha };
