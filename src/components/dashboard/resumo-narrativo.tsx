'use client';

import * as React from 'react';
import { CircleCheck, PiggyBank, Tag, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react';
import { moeda } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ResumoMes, LinhaOrcamento } from '@/lib/financas';
import type { LucideIcon } from 'lucide-react';

interface Frase {
  id: string;
  texto: string;
  icone: LucideIcon;
  tom: 'positivo' | 'critico' | 'neutro';
}

const TONS = {
  positivo: 'bg-cedula-soft text-cedula-ink',
  critico: 'bg-coral-soft text-coral',
  neutro: 'bg-surface-sunken text-ink-muted',
} as const;

/**
 * O mês em frases curtas, todas derivadas dos lançamentos reais do período
 * selecionado. Cada frase só é montada quando existe base para ela — sem dado
 * suficiente, a frase simplesmente não aparece. Nada aqui é estimado.
 */
export function ResumoNarrativo({
  mes,
  anterior,
  maiorCategoria,
  orcamentos,
  oculto,
  className,
}: {
  mes: ResumoMes;
  anterior: ResumoMes;
  maiorCategoria: { nome: string; total: number } | null;
  orcamentos: LinhaOrcamento[];
  oculto: boolean;
  className?: string;
}) {
  const frases: Frase[] = [];
  const cifra = (v: number) => moeda(v, { oculto });

  // 1. Variação de despesa. Sem mês anterior com gasto não há percentual honesto.
  if (anterior.despesas > 0 && mes.despesas > 0) {
    const variacao = ((mes.despesas - anterior.despesas) / anterior.despesas) * 100;
    if (Math.abs(variacao) >= 1) {
      const subiu = variacao > 0;
      frases.push({
        id: 'variacao',
        icone: subiu ? TrendingUp : TrendingDown,
        tom: subiu ? 'critico' : 'positivo',
        texto: `Você gastou ${Math.abs(variacao).toFixed(0)}% ${subiu ? 'mais' : 'menos'} que no mês passado`,
      });
    }
  }

  // 2. Concentração de gasto.
  if (maiorCategoria && maiorCategoria.total > 0) {
    frases.push({
      id: 'categoria',
      icone: Tag,
      tom: 'neutro',
      texto: `Sua maior categoria de gastos foi ${maiorCategoria.nome}`,
    });
  }

  // 3. Sobra do mês.
  if (mes.receitas > 0 || mes.despesas > 0) {
    frases.push(
      mes.economia >= 0
        ? {
            id: 'economia',
            icone: PiggyBank,
            tom: 'positivo',
            texto: `Você economizou ${cifra(mes.economia)} este mês`,
          }
        : {
            id: 'economia',
            icone: TriangleAlert,
            tom: 'critico',
            texto: `Você gastou ${cifra(Math.abs(mes.economia))} a mais do que recebeu`,
          },
    );
  }

  // 4. Orçamento — só quando existe teto definido para comparar.
  if (orcamentos.length) {
    const estourados = orcamentos.filter((l) => l.situacao === 'estourado');
    frases.push(
      estourados.length
        ? {
            id: 'orcamento',
            icone: TriangleAlert,
            tom: 'critico',
            texto: `${estourados.length} ${
              estourados.length === 1 ? 'categoria passou' : 'categorias passaram'
            } do teto`,
          }
        : {
            id: 'orcamento',
            icone: CircleCheck,
            tom: 'positivo',
            texto: 'Você está dentro do orçamento deste mês',
          },
    );
  }

  if (!frases.length) return null;

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {frases.map((f) => {
        const Icone = f.icone;
        return (
          <li
            key={f.id}
            className={cn(
              'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-[12.5px] font-medium',
              TONS[f.tom],
            )}
          >
            <Icone className="size-3.5 shrink-0" aria-hidden />
            {f.texto}
          </li>
        );
      })}
    </ul>
  );
}
