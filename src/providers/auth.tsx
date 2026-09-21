'use client';

import * as React from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, mensagemDeErro, supabaseConfigurado } from '@/lib/supabase/cliente';

/**
 * Sessão real, via Supabase Auth.
 *
 * Substitui lib/sessao.ts, que guardava um nome no localStorage e chamava
 * aquilo de login. Aqui há senha, token com validade e renovação automática.
 *
 * A sessão vive no localStorage do SDK porque o app é um site estático: não há
 * servidor para manter cookie de sessão. Isso é o padrão de SPA e está correto
 * — o que protege os dados não é onde o token fica, e sim o RLS no Postgres,
 * que recusa qualquer linha que não seja do `auth.uid()` do token apresentado.
 */

interface ContextoAuth {
  /** `undefined` enquanto a sessão ainda está sendo lida. */
  sessao: Session | null | undefined;
  usuario: User | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (email: string, senha: string, nome: string) => Promise<{ precisaConfirmar: boolean }>;
  sair: () => Promise<void>;
  recuperarSenha: (email: string) => Promise<void>;
}

const Contexto = React.createContext<ContextoAuth | null>(null);

export function ProvedorAuth({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = React.useState<Session | null | undefined>(
    // Sem Supabase configurado não há o que carregar: resolve como deslogado
    // em vez de deixar a interface presa num esqueleto para sempre.
    supabaseConfigurado ? undefined : null,
  );

  React.useEffect(() => {
    if (!supabaseConfigurado) return;
    const sb = getSupabase();

    // getSession lê o token já gravado; onAuthStateChange cobre login, logout,
    // renovação e o retorno do link de confirmação de e-mail.
    sb.auth.getSession().then(({ data }) => setSessao(data.session));

    const { data: inscricao } = sb.auth.onAuthStateChange((_evento, nova) => {
      setSessao(nova);
    });

    return () => inscricao.subscription.unsubscribe();
  }, []);

  const valor = React.useMemo<ContextoAuth>(
    () => ({
      sessao,
      usuario: sessao?.user ?? null,
      carregando: sessao === undefined,

      async entrar(email, senha) {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error(mensagemDeErro(error));
      },

      async cadastrar(email, senha, nome) {
        const { data, error } = await getSupabase().auth.signUp({
          email,
          password: senha,
          options: {
            // Lido pelo trigger criar_perfil_do_usuario para preencher o perfil.
            data: { nome },
            // Precisa bater com uma das Redirect URLs cadastradas no Supabase.
            emailRedirectTo: typeof window !== 'undefined'
              ? `${window.location.origin}${window.location.pathname}`
              : undefined,
          },
        });
        if (error) throw new Error(mensagemDeErro(error));

        // Com confirmação de e-mail ligada, o Supabase devolve usuário sem
        // sessão. Sem ela, já vem logado.
        return { precisaConfirmar: Boolean(data.user && !data.session) };
      },

      async sair() {
        const { error } = await getSupabase().auth.signOut();
        if (error) throw new Error(mensagemDeErro(error));
      },

      async recuperarSenha(email) {
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}`
            : undefined,
        });
        if (error) throw new Error(mensagemDeErro(error));
      },
    }),
    [sessao],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ContextoAuth {
  const contexto = React.useContext(Contexto);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <ProvedorAuth>.');
  return contexto;
}
