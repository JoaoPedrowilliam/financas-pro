'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Eye, EyeOff, LogOut, Menu, Plus, Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlternarTema } from './alternar-tema';
import { TODOS_ITENS } from './navegacao';
import { useFinancas } from '@/store/use-financas';
import { iniciais } from '@/lib/format';
import { encerrarSessao } from '@/lib/sessao';

export function Topbar({
  onAbrirMenu,
  onNovoLancamento,
}: {
  onAbrirMenu: () => void;
  onNovoLancamento: () => void;
}) {
  const caminho = usePathname();
  const router = useRouter();
  const perfil = useFinancas((s) => s.perfil);
  const alternarOcultar = useFinancas((s) => s.alternarOcultarValores);
  const [busca, setBusca] = React.useState('');
  const campoBusca = React.useRef<HTMLInputElement>(null);

  const pagina = TODOS_ITENS.find((i) => caminho === i.href || caminho.startsWith(`${i.href}/`));

  // Atalho global: "/" foca a busca, como em ferramentas de produtividade.
  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName);
      if (e.key === '/' && !digitando) {
        e.preventDefault();
        campoBusca.current?.focus();
      }
      if (e.key === 'Escape') campoBusca.current?.blur();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!busca.trim()) return;
    router.push(`/financas?busca=${encodeURIComponent(busca.trim())}`);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-[hsl(var(--surface-raised)/0.85)] px-4 backdrop-blur-md lg:px-6">
      <Button variant="fantasma" size="icone" className="lg:hidden" onClick={onAbrirMenu} aria-label="Abrir menu">
        <Menu />
      </Button>

      <p className="font-display text-[15px] font-semibold lg:hidden">{pagina?.rotulo ?? 'Finanças Pro'}</p>

      <form onSubmit={buscar} className="relative ml-auto hidden max-w-sm flex-1 md:block lg:ml-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <Input
          ref={campoBusca}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar lançamento, categoria ou valor"
          className="h-9 pl-9 pr-10"
          aria-label="Buscar lançamentos"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line bg-surface-sunken px-1.5 text-[10px] text-ink-faint">
          /
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <Button onClick={onNovoLancamento} size="sm" className="hidden sm:inline-flex">
          <Plus />
          Novo lançamento
        </Button>
        <Button onClick={onNovoLancamento} size="icone" className="sm:hidden" aria-label="Novo lançamento">
          <Plus />
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="fantasma"
              size="icone"
              onClick={alternarOcultar}
              aria-pressed={perfil.ocultarValores}
              aria-label={perfil.ocultarValores ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {perfil.ocultarValores ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {perfil.ocultarValores ? 'Mostrar valores' : 'Ocultar valores na tela'}
          </TooltipContent>
        </Tooltip>

        <AlternarTema />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-cedula-soft text-[13px] font-semibold text-cedula-ink transition-colors hover:bg-cedula/20"
              aria-label="Abrir menu da conta"
            >
              {iniciais(perfil.nome || 'Visitante') || <UserRound className="size-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block truncate text-[13px] font-medium text-ink">{perfil.nome || 'Visitante'}</span>
              <span className="block truncate">{perfil.email || 'sem e-mail cadastrado'}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/configuracoes">
                <UserRound />
                Perfil e preferências
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destrutivo
              onSelect={() => {
                encerrarSessao();
                router.push('/login');
              }}
            >
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
