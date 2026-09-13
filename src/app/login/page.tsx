'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlternarTema } from '@/components/layout/alternar-tema';
import { useFinancas } from '@/store/use-financas';
import { iniciarSessao } from '@/lib/sessao';

export default function PaginaLogin() {
  const router = useRouter();
  const updatePerfil = useFinancas((s) => s.updatePerfil);
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');

  const entrar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    iniciarSessao(nome.trim(), email.trim());
    updatePerfil({ nome: nome.trim(), email: email.trim() });
    router.push('/dashboard');
  };

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-10">
        <AlternarTema />
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={entrar} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-[10px] bg-cedula text-cedula-fg">
              <Sprout className="size-5" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-[16px] font-semibold tracking-tight">Finanças Pro</p>
              <p className="text-[11.5px] text-ink-faint">Seu dinheiro, organizado</p>
            </div>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight">Vamos começar</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            Seus dados ficam neste dispositivo. Nada é enviado para um servidor.
          </p>

          <div className="mt-7 space-y-4">
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

            <div>
              <Label htmlFor="login-email">E-mail (opcional)</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                autoComplete="email"
                className="mt-1.5"
              />
              <p className="mt-1 text-[11.5px] text-ink-faint">
                Aparece nos relatórios exportados. Não é usado para login.
              </p>
            </div>
          </div>

          <Button type="submit" size="lg" className="mt-6 w-full" disabled={!nome.trim()}>
            Entrar
          </Button>

          <div className="mt-6 flex gap-2.5 rounded-control border border-ambar/40 bg-ambar-soft p-3">
            <ShieldAlert className="size-4 shrink-0 text-ambar" />
            <p className="text-[12px] leading-relaxed text-ink-muted">
              Esta tela ainda não é autenticação: não há senha nem servidor, e os dados ficam sem
              criptografia no navegador. Antes de usar com informações reais, troque{' '}
              <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11px]">lib/sessao.ts</code> por um
              provedor de verdade.
            </p>
          </div>
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
