'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MailCheck, ShieldAlert, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlternarTema } from '@/components/layout/alternar-tema';
import { useAuth } from '@/providers/auth';
import { supabaseConfigurado } from '@/lib/supabase/cliente';

/**
 * Entrada do sistema — agora com autenticação de verdade.
 *
 * Substitui a tela que só pedia um nome e gravava no localStorage. A mesma
 * página atende os dois fluxos (entrar e criar conta) porque separá-los em duas
 * rotas dobraria o caminho de quem só quer voltar para a própria carteira.
 */
export default function PaginaLogin() {
  const router = useRouter();
  const { sessao, entrar, cadastrar, recuperarSenha } = useAuth();

  const [modo, setModo] = React.useState<'entrar' | 'cadastrar'>('entrar');
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);

  // Quem já tem sessão válida não precisa ver esta tela.
  React.useEffect(() => {
    if (sessao) router.replace('/dashboard');
  }, [sessao, router]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setAviso('');
    setEnviando(true);
    try {
      if (modo === 'entrar') {
        await entrar(email.trim(), senha);
        router.replace('/dashboard');
      } else {
        const { precisaConfirmar } = await cadastrar(email.trim(), senha, nome.trim());
        if (precisaConfirmar) {
          setAviso(
            'Conta criada. Confirme o e-mail pelo link que enviamos e depois volte aqui para entrar.',
          );
          setModo('entrar');
          setSenha('');
        } else {
          router.replace('/dashboard');
        }
      }
    } catch (falha) {
      // A senha some, o e-mail fica: quase sempre o erro é na senha.
      setErro(falha instanceof Error ? falha.message : 'Não foi possível continuar.');
      setSenha('');
    } finally {
      setEnviando(false);
    }
  };

  const esqueci = async () => {
    if (!email.trim()) {
      setErro('Digite seu e-mail primeiro para receber o link de recuperação.');
      return;
    }
    setErro('');
    try {
      await recuperarSenha(email.trim());
      setAviso('Se existir uma conta com este e-mail, o link de recuperação chegou na caixa de entrada.');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível enviar o link.');
    }
  };

  const criando = modo === 'cadastrar';
  const podeEnviar =
    email.trim().length > 3 && senha.length >= 6 && (!criando || nome.trim().length > 0);

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-10">
        <AlternarTema />
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={enviar} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-[10px] bg-cedula text-cedula-fg">
              <Sprout className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-[16px] font-semibold tracking-tight">Finanças Pro</p>
              <p className="text-[11.5px] text-ink-faint">Seu dinheiro, organizado</p>
            </div>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {criando ? 'Criar sua conta' : 'Entrar na sua conta'}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {criando
              ? 'Seus dados ficam na sua conta e acompanham você em qualquer aparelho.'
              : 'Use o e-mail e a senha que você cadastrou.'}
          </p>

          {!supabaseConfigurado && (
            <div className="mt-6 flex gap-2.5 rounded-control border border-ambar/40 bg-ambar-soft p-3">
              <ShieldAlert className="size-4 shrink-0 text-ambar" />
              <p className="text-[12px] leading-relaxed text-ink-muted">
                O banco de dados ainda não foi configurado neste ambiente. Defina{' '}
                <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11px]">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{' '}
                e{' '}
                <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11px]">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </code>{' '}
                para poder entrar.
              </p>
            </div>
          )}

          <div className="mt-7 space-y-4">
            {criando && (
              <div>
                <Label htmlFor="login-nome">Como você quer ser chamado</Label>
                <Input
                  id="login-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  autoFocus
                  autoComplete="name"
                  className="mt-1.5"
                />
              </div>
            )}

            <div>
              <Label htmlFor="login-email">E-mail</Label>
              <Input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                autoComplete="email"
                autoFocus={!criando}
                className="mt-1.5"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="login-senha">Senha</Label>
                {!criando && (
                  <button
                    type="button"
                    onClick={esqueci}
                    className="text-[12px] font-medium text-cedula hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <Input
                id="login-senha"
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Pelo menos 6 caracteres"
                autoComplete={criando ? 'new-password' : 'current-password'}
                aria-invalid={Boolean(erro)}
                className="mt-1.5"
              />
            </div>
          </div>

          {erro && (
            <p role="alert" className="mt-4 text-[13px] leading-relaxed text-coral">
              {erro}
            </p>
          )}

          {aviso && (
            <div className="mt-4 flex gap-2.5 rounded-control border border-cedula/40 bg-cedula-soft p-3">
              <MailCheck className="size-4 shrink-0 text-cedula-ink" />
              <p className="text-[12.5px] leading-relaxed text-ink-muted">{aviso}</p>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="mt-6 w-full"
            disabled={!podeEnviar || enviando || !supabaseConfigurado}
          >
            {enviando ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}
          </Button>

          <p className="mt-5 text-center text-[13px] text-ink-muted">
            {criando ? 'Já tem uma conta?' : 'Ainda não tem conta?'}{' '}
            <button
              type="button"
              onClick={() => {
                setModo(criando ? 'entrar' : 'cadastrar');
                setErro('');
                setAviso('');
              }}
              className="font-medium text-cedula hover:underline"
            >
              {criando ? 'Entrar' : 'Criar agora'}
            </button>
          </p>
        </form>
      </div>

      {/* Painel de apoio: some no mobile, onde a única tarefa é entrar. */}
      <aside className="hidden flex-col justify-center bg-surface-sunken px-12 lg:flex">
        <blockquote className="max-w-md">
          <p className="font-display text-2xl font-medium leading-snug tracking-tight">
            Organizar dinheiro é menos sobre disciplina e mais sobre enxergar o que já está acontecendo.
          </p>
          <p className="mt-6 text-sm leading-relaxed text-ink-muted">
            O sistema calcula os juros que você paga sem perceber, avisa quando uma conta variável foge da
            média e mostra em quantos meses você fica livre das dívidas — com os números do seu mês, não
            com regra de bolso.
          </p>
        </blockquote>

        <ul className="mt-10 grid max-w-md grid-cols-2 gap-4 text-[13px]">
          {[
            ['Fluxo mensal', 'Receitas, despesas e o que sobrou, mês a mês'],
            ['Cartões', 'Faturas, limite comprometido e parcelas futuras'],
            ['Dívidas', 'Simulador de quitação e ordem de pagamento'],
            ['Patrimônio', 'Contas, investimentos e dívidas em um número'],
          ].map(([titulo, desc]) => (
            <li key={titulo} className="rounded-control border border-line bg-surface-raised p-3">
              <p className="font-medium">{titulo}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{desc}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
