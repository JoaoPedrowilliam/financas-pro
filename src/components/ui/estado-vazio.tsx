import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tela vazia é convite para agir, não recado de erro:
 * diz o que existe aqui e oferece o próximo passo.
 */
export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-card bg-surface-sunken text-ink-faint">
        <Icone className="size-6" />
      </div>
      <p className="font-display text-base font-semibold">{titulo}</p>
      <p className="mt-1 max-w-sm text-balance text-sm leading-relaxed text-ink-muted">{descricao}</p>
      {acao ? <div className="mt-5">{acao}</div> : null}
    </div>
  );
}
