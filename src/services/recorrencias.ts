import { criarServico } from './base';
import { recorrenciaDeLinha, recorrenciaParaLinha } from '@/lib/supabase/mapear';
import type { Recorrencia } from '@/types';

/** Contas fixas e variáveis que geram lançamentos todo mês. */
export const servicoRecorrencias = criarServico<Recorrencia>('recorrencias', recorrenciaDeLinha, {
  coluna: 'dia_vencimento',
  crescente: true,
});

export { recorrenciaParaLinha };
