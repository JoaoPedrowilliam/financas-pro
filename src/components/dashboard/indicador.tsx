'use client';
import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Valor } from '@/components/shared/valor';
import { percentual } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

/**
 * Indicador compacto: fica ao lado do bloco-herói, em coluna.
 * Propositalmente pequeno — cinco cards do mesmo peso viram ruído.
 */
export function Indicador({
  rotulo,
  valor,
  variacao,
  variacaoInvertida = false,
  icone: Icone,
  tom = 'neutro',
  nota,
  indice = 0,
}: {
  rotulo: string;
  valor: number;
  variacao?: number | null;
  /**
   * Inverte o julgamento da variação: em despesa, subir é ruim.
   * Sem isso, "+50% de despesa" apareceria em verde.
   */
  variacaoInvertida?: boolean;
  icone: LucideIcon;
  tom?: 'neutro' | 'positivo' | 'critico' | 'info';
  nota?: string;
  indice?: number;
}) {
  const semMovimento = useReducedMotion();
  const tons = {
    neutro: 'text-ink-muted bg-surface-sunken',
    positivo: 'text-cedula-ink bg-cedula-soft',
    critico: 'text-coral bg-coral-soft',
    info: 'text-aco bg-aco-soft',
  } as const;

  const subiu = (variacao ?? 0) >= 0;
  const bom = variacaoInvertida ? !subiu : subiu;
  const Seta = subiu ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      initial={semMovimento ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: semMovimento ? 0 : 0.06 * indice, ease: [0.16, 1, 0.3, 1] }}
      className="painel painel-interativo flex items-center gap-3 p-4"
    >
      <div className={cn('grid size-9 shrink-0 place-items-center rounded-control', tons[tom])}>
        <Icone className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-ink-muted">{rotulo}</p>
        <Valor valor={valor} className="block truncate font-display text-[19px] font-semibold" />
        {nota ? <p className="truncate text-[11px] text-ink-faint">{nota}</p> : null}
      </div>
      {variacao !== undefined && variacao !== null && (
        <span
          className={cn(
            'cifra flex shrink-0 items-center gap-0.5 text-[12px] font-medium',
            bom ? 'text-cedula-ink' : 'text-coral',
          )}
        >
          {/* A seta repete o sentido da variação: a cor sozinha não conta a história. */}
          <Seta className="size-3.5" aria-hidden />
          {percentual(variacao, 0)}
        </span>
      )}
    </motion.div>
  );
}
