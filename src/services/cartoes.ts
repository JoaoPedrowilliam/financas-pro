import { criarServico } from './base';
import { cartaoDeLinha, cartaoParaLinha } from '@/lib/supabase/mapear';
import type { Cartao } from '@/types';

/** Cartões. Fatura não é persistida: faturaDoCartao() a deriva das transações. */
export const servicoCartoes = criarServico<Cartao>('cartoes', cartaoDeLinha, {
  coluna: 'criado_em',
  crescente: true,
});

export { cartaoParaLinha };
