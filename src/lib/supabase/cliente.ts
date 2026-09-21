'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente único do Supabase, no navegador.
 *
 * Por que só no navegador: o app é publicado como site estático no GitHub
 * Pages. Não existe servidor para guardar sessão, então a autenticação é toda
 * client-side e a sessão fica no localStorage do próprio SDK — que é o padrão
 * de SPA e o único caminho possível aqui.
 *
 * A anon key é pública por natureza; ela não é um segredo. Quem protege os
 * dados é o RLS no Postgres, não esta chave. A service role key NUNCA pode
 * aparecer neste projeto: qualquer variável embutida no bundle é legível por
 * qualquer visitante.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Sem variáveis configuradas o app continua compilando e abrindo. Isso é
 * deliberado: quebrar a tela inteira porque falta um `.env` deixaria o
 * desenvolvedor sem nenhum caminho de volta. Em vez disso a interface avisa o
 * que falta configurar.
 */
export const supabaseConfigurado = Boolean(url && chave);

let instancia: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseConfigurado) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  // Uma instância só por aba: cada createClient abre o próprio canal de refresh
  // de token, e dois deles competindo causam logout aleatório.
  instancia ??= createClient(url!, chave!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // A confirmação de e-mail volta com o token no fragmento da URL.
      detectSessionInUrl: true,
      storageKey: 'financas-pro:auth',
    },
  });
  return instancia;
}

/** Mensagem de erro legível a partir do que o Supabase devolve. */
export function mensagemDeErro(erro: unknown): string {
  if (!erro) return 'Erro desconhecido.';

  const bruto =
    typeof erro === 'string'
      ? erro
      : erro instanceof Error
        ? erro.message
        : String((erro as { message?: string })?.message ?? erro);

  // Traduções dos casos que o usuário realmente encontra. O resto passa cru:
  // inventar texto amigável para erro desconhecido esconde o diagnóstico.
  const mapa: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar. Procure a mensagem na caixa de entrada.',
    'User already registered': 'Já existe uma conta com este e-mail. Tente entrar.',
    'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
    'Failed to fetch': 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
  };

  for (const [chaveErro, texto] of Object.entries(mapa)) {
    if (bruto.includes(chaveErro)) return texto;
  }
  return bruto;
}
