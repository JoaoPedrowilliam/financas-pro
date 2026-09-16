import { criarServico } from './base';
import { metaDeLinha, metaParaLinha } from '@/lib/supabase/mapear';
import type { Meta } from '@/types';

/** Objetivos de poupança. */
export const servicoMetas = criarServico<Meta>('metas', metaDeLinha, {
  coluna: 'prazo',
  crescente: true,
});

export { metaParaLinha };
