'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CloudOff, Lock, RefreshCw } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { DialogTransacao } from '@/components/transacoes/dialog-transacao';
import { ConviteMigracao } from '@/components/shared/convite-migracao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinancas } from '@/store/use-financas';
import { useAuth } from '@/providers/auth';
import { lerPinLocal } from '@/services/perfil';
import { pinConfere } from '@/lib/sessao';
import { supabaseConfigurado } from '@/lib/supabase/cliente';

const CHAVE_RECOLHIDA = 'financas-pro:sidebar-recolhida';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { sessao, carregando: carregandoSessao } = useAuth();

  const [recolhida, setRecolhida] = React.useState(false);
  const [menuMovel, setMenuMovel] = React.useState(false);
  const [novoLancamento, setNovoLancamento] = React.useState(false);
  const [destravado, setDestravado] = React.useState(false);

  const hidratado = useFinancas((s) => s.hidratado);
  const erro = useFinancas((s) => s.erro);
  const carregarDoServidor = useFinancas((s) => s.carregarDoServidor);
  const limparSessao = useFinancas((s) => s.limparSessao);
  const semMovimento = useReducedMotion();

  // O PIN é trava local de tela, lida do dispositivo — não do banco.
  const [pin, setPin] = React.useState<string | null>(null);
  React.useEffect(() => setPin(lerPinLocal()), []);

  React.useEffect(() => {
    setRecolhida(window.localStorage.getItem(CHAVE_RECOLHIDA) === '1');
  }, []);

  /**
   * Guarda de rota.
   *
   * É proteção de navegação, não de dados: num site estático não há servidor
   * para barrar ninguém antes da página carregar. Quem tentar chamar a API sem
   * sessão é recusado pelo RLS no Postgres, que é onde a segurança realmente
   * mora.
   */
  React.useEffect(() => {
    if (carregandoSessao) return;
    if (!sessao) {
      limparSessao();
      router.replace('/login');
    }
  }, [sessao, carregandoSessao, router, limparSessao]);

  // Carrega os dados assim que existe sessão, e recarrega ao trocar de conta.
  const usuarioId = sessao?.user.id;
  React.useEffect(() => {
    if (usuarioId) void carregarDoServidor();
  }, [usuarioId, carregarDoServidor]);

  const alternarSidebar = () => {
    setRecolhida((atual) => {
      window.localStorage.setItem(CHAVE_RECOLHIDA, atual ? '0' : '1');
      return !atual;
    });
  };

  if (!supabaseConfigurado) return <BancoNaoConfigurado />;
  if (carregandoSessao || !sessao) return <EsqueletoInicial />;
  if (erro && !hidratado) return <FalhaAoCarregar erro={erro} onTentar={() => void carregarDoServidor()} />;
  if (!hidratado) return <EsqueletoInicial />;
  if (pin && !destravado) return <TelaBloqueio pin={pin} onDestravar={() => setDestravado(true)} />;

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="sticky top-0 hidden h-dvh shrink-0 lg:block">
        <Sidebar recolhida={recolhida} onAlternar={alternarSidebar} />
      </aside>

      <AnimatePresence>
        {menuMovel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuMovel(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={semMovimento ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar
                recolhida={false}
                onAlternar={() => setMenuMovel(false)}
                onNavegar={() => setMenuMovel(false)}
                className="h-dvh"
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onAbrirMenu={() => setMenuMovel(true)} onNovoLancamento={() => setNovoLancamento(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {/* Aparece uma vez, quando há dados antigos no navegador desta pessoa. */}
          <ConviteMigracao />
          {children}
        </main>
      </div>

      <DialogTransacao aberto={novoLancamento} onAbertoChange={setNovoLancamento} />
    </div>
  );
}

function EsqueletoInicial() {
  return (
    <div className="flex min-h-dvh bg-surface">
      <div className="hidden w-[252px] shrink-0 border-r border-line bg-surface-sidebar p-4 lg:block">
        <Skeleton className="h-8 w-40" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-8">
        <Skeleton className="h-9 w-64" />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-52 lg:col-span-2" />
          <Skeleton className="h-52" />
        </div>
      </div>
    </div>
  );
}

/**
 * Falha de carga. Mostra o motivo e oferece nova tentativa em vez de abrir uma
 * carteira vazia — que pareceria perda de dados.
 */
function FalhaAoCarregar({ erro, onTentar }: { erro: string; onTentar: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-card bg-coral-soft text-coral">
          <CloudOff className="size-5" />
        </div>
        <h1 className="font-display text-xl font-semibold">Não foi possível carregar seus dados</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{erro}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
          Nada foi perdido — os dados continuam no servidor. Isto é uma falha de conexão.
        </p>
        <Button onClick={onTentar} className="mt-6">
          <RefreshCw />
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}

/** Ambiente sem variáveis do Supabase: explica o que falta em vez de cair. */
function BancoNaoConfigurado() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-6">
      <div className="w-full max-w-lg">
        <h1 className="font-display text-xl font-semibold">Banco de dados não configurado</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Esta instalação ainda não aponta para um projeto Supabase. Defina as duas variáveis abaixo
          em <code className="rounded bg-surface-sunken px-1 py-0.5 text-[12px]">.env.local</code> (ou
          nos segredos do repositório, em produção) e recarregue.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-control border border-line bg-surface-sunken p-4 text-[12.5px] leading-relaxed">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=`}
        </pre>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
          As duas são públicas por natureza. Nenhuma chave de serviço deve entrar aqui: tudo que o
          front carrega é legível por quem abrir o site.
        </p>
      </div>
    </div>
  );
}

function TelaBloqueio({ pin, onDestravar }: { pin: string; onDestravar: () => void }) {
  const [valor, setValor] = React.useState('');
  const [erro, setErro] = React.useState('');

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinConfere(valor, pin)) return onDestravar();
    setErro('PIN incorreto. Tente de novo.');
    setValor('');
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-6">
      <form onSubmit={enviar} className="w-full max-w-xs text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-card bg-cedula-soft text-cedula-ink">
          <Lock className="size-5" />
        </div>
        <h1 className="font-display text-xl font-semibold">Digite seu PIN</h1>
        <p className="mt-1 text-sm text-ink-muted">Trava deste aparelho, além da sua senha.</p>
        <Input
          value={valor}
          onChange={(e) => {
            setValor(e.target.value.replace(/\D/g, '').slice(0, 8));
            setErro('');
          }}
          type="password"
          inputMode="numeric"
          autoFocus
          aria-label="PIN de acesso"
          aria-invalid={Boolean(erro)}
          className="mt-6 text-center text-lg tracking-[0.5em]"
        />
        {erro ? (
          <p role="alert" className="mt-2 text-[13px] text-coral">
            {erro}
          </p>
        ) : null}
        <Button type="submit" className="mt-4 w-full" disabled={valor.length < 4}>
          Desbloquear
        </Button>
      </form>
    </div>
  );
}
