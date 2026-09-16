import { getSupabase } from '@/lib/supabase/cliente';
import { ErroDeDados, usuarioAtual } from './base';
import { perfilDeLinha, perfilParaLinha } from '@/lib/supabase/mapear';
import type { Perfil } from '@/types';

/**
 * Perfil do usuário — um por conta, criado pelo trigger `ao_criar_usuario`.
 *
 * O PIN de bloqueio NÃO está aqui. Ele é uma trava de tela do dispositivo e
 * guardá-lo no banco significaria um segredo em texto puro, replicado, para
 * proteger algo que a autenticação já protege. Continua onde sempre esteve:
 * no navegador de quem o configurou.
 */

const CHAVE_PIN = 'financas-pro:pin';

export function lerPinLocal(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(CHAVE_PIN);
  } catch {
    return null;
  }
}

export function gravarPinLocal(pin: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (pin) window.localStorage.setItem(CHAVE_PIN, pin);
    else window.localStorage.removeItem(CHAVE_PIN);
  } catch {
    // Navegador com armazenamento bloqueado: a trava simplesmente não existe.
  }
}

export const servicoPerfil = {
  async carregar(): Promise<Perfil> {
    const id = await usuarioAtual();
    const { data, error } = await getSupabase()
      .from('perfis')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new ErroDeDados('perfis', 'carregar', error);
    return perfilDeLinha(data, lerPinLocal());
  },

  async atualizar(mudancas: Partial<Perfil>): Promise<void> {
    // O PIN nunca viaja: é interceptado antes de virar coluna.
    if (mudancas.bloqueioPin !== undefined) {
      gravarPinLocal(mudancas.bloqueioPin ?? null);
    }

    const linha = perfilParaLinha(mudancas);
    if (!Object.keys(linha).length) return;

    const id = await usuarioAtual();
    const { error } = await getSupabase().from('perfis').update(linha).eq('id', id);
    if (error) throw new ErroDeDados('perfis', 'atualizar', error);
  },
};
