import { criarServico } from './base';
import { contaDeLinha, contaParaLinha } from '@/lib/supabase/mapear';
import type { Conta } from '@/types';

/** Contas bancárias. O saldo NÃO é coluna: é derivado por saldoDaConta(). */
export const servicoContas = criarServico<Conta>('contas', contaDeLinha, {
  coluna: 'criado_em',
  crescente: true,
});

export { contaParaLinha };
