import { criarServico } from './base';
import { categoriaDeLinha, categoriaParaLinha } from '@/lib/supabase/mapear';
import type { Categoria } from '@/types';

/** Categorias do usuário. A hierarquia de um nível vive em `pai_id`. */
export const servicoCategorias = criarServico<Categoria>('categorias', categoriaDeLinha, {
  coluna: 'nome',
  crescente: true,
});

export { categoriaParaLinha };
