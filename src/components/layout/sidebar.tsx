'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, Sprout } from 'lucide-react';
import { NAVEGACAO } from './navegacao';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function Sidebar({
  recolhida,
  onAlternar,
  onNavegar,
  className,
}: {
  recolhida: boolean;
  onAlternar: () => void;
  onNavegar?: () => void;
  className?: string;
}) {
  const caminho = usePathname();
  const semMovimento = useReducedMotion();

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'flex h-full flex-col border-r border-line bg-surface-sidebar transition-[width] duration-300 ease-out',
        recolhida ? 'w-[72px]' : 'w-[252px]',
        className,
      )}
    >
      <div className={cn('flex h-16 items-center gap-2.5 px-4', recolhida && 'justify-center px-0')}>
        <div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-cedula text-cedula-fg">
          <Sprout className="size-[18px]" />
        </div>
        {!recolhida && (
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[15px] font-semibold tracking-tight">Finanças Pro</p>
            <p className="truncate text-[11px] text-ink-faint">Seu dinheiro, organizado</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scroll-fino px-3 pb-4 pt-2">
        {NAVEGACAO.map((grupo, iGrupo) => (
          <div key={grupo.titulo} className={cn(iGrupo > 0 && 'mt-6')}>
            {recolhida ? (
              // Recolhida não cabe rótulo: um filete no lugar preserva o agrupamento.
              iGrupo > 0 && <div className="mx-auto mb-3 h-px w-6 bg-line" aria-hidden />
            ) : (
              <p className="mb-2 px-2.5 text-micro font-semibold uppercase tracking-[0.08em] text-ink-faint">
                {grupo.titulo}
              </p>
            )}
            <ul className="space-y-1">
              {grupo.itens.map((item) => {
                const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);
                const Icone = item.icone;

                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavegar}
                    aria-current={ativo ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-control px-2.5 py-2 text-sm transition-colors duration-150',
                      recolhida && 'justify-center px-0',
                      ativo
                        ? 'text-cedula-ink'
                        : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    {ativo && (
                      <motion.span
                        layoutId="nav-ativo"
                        transition={semMovimento ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 34 }}
                        className="absolute inset-0 -z-10 rounded-control bg-cedula-soft"
                      />
                    )}
                    {/* Trilho verde: o estado ativo não depende só da cor do texto. */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-cedula transition-opacity duration-150',
                        ativo ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <Icone className={cn('size-[18px] shrink-0', ativo && 'text-cedula')} />
                    {!recolhida && <span className="truncate font-medium">{item.rotulo}</span>}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {recolhida ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="font-medium">{item.rotulo}</p>
                          <p className="text-ink-muted">{item.resumo}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <Button
          variant="fantasma"
          size={recolhida ? 'icone' : 'sm'}
          onClick={onAlternar}
          className={cn('w-full', recolhida && 'mx-auto w-9')}
          aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
        >
          {recolhida ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!recolhida && <span>Recolher menu</span>}
        </Button>
      </div>
    </nav>
  );
}
