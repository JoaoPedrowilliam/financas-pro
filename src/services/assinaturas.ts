import { criarServico } from './base';
import { assinaturaDeLinha, assinaturaParaLinha } from '@/lib/supabase/mapear';
import type { Assinatura } from '@/types';

/** Cobranças recorrentes no cartão. */
export const servicoAssinaturas = criarServico<Assinatura>('assinaturas', assinaturaDeLinha, {
  coluna: 'dia_cobranca',
  crescente: true,
});

export { assinaturaParaLinha };
