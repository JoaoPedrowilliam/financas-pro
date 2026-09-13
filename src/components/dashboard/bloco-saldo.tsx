'use client';

import * as React from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { moeda, percentual } from '@/lib/format';
import { useFinancas } from '@/store/use-financas';
import { cn } from '@/lib/utils';

/**
 * O herói do dashboard. É o único número em corpo grande da tela —
 * tudo em volta é deliberadamente discreto para ele carregar a hierarquia.
 */
export function BlocoSaldo({
  saldo,
  variacaoMes,
  serie,
  rotulo = 'Saldo em contas',
  contexto,
}: {
  saldo: number;
  variacaoMes: number | null;
  serie: { valor: number }[];
  rotulo?: string;
  contexto?: React.ReactNode;
}) {
  const oculto = useFinancas((s) => s.perfil.ocultarValores);
  const positivo = (variacaoMes ?? 0) >= 0;

  return (
    <section className="painel relative overflow-hidden p-6 shadow-raised sm:p-7">
      {/* A sparkline é fundo, não gráfico: dá a forma do mês sem competir com a cifra. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-[0.16]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={serie} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad-saldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--cedula))" stopOpacity={0.9} />
                <stop offset="100%" stopColor="hsl(var(--cedula))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Area
              type="monotone"
              dataKey="valor"
              stroke="hsl(var(--cedula))"
              strokeWidth={2}
              fill="url(#grad-saldo)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="relative">
        <p className="text-[13px] font-medium text-ink-muted">{rotulo}</p>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <ContagemAnimada
            valor={saldo}
            oculto={oculto}
            className={cn(
              'cifra font-display text-cifra font-semibold sm:text-cifra-lg',
              saldo < 0 && 'text-coral',
            )}
          />
          {variacaoMes !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[13px] font-medium',
                positivo ? 'bg-cedula-soft text-cedula-ink' : 'bg-coral-soft text-coral',
              )}
            >
              {positivo ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {percentual(variacaoMes, 1)}
              <span className="font-normal opacity-80">no mês</span>
            </span>
          )}
        </div>

        {contexto ? <div className="mt-4">{contexto}</div> : null}
      </div>
    </section>
  );
}

/**
 * Conta do zero até o valor uma única vez, na entrada do dashboard.
 * É a única animação não disparada pelo usuário na tela — por isso ela é curta
 * e some se a pessoa pediu menos movimento no sistema.
 */
function ContagemAnimada({
  valor,
  oculto,
  className,
}: {
  valor: number;
  oculto: boolean;
  className?: string;
}) {
  const semMovimento = useReducedMotion();
  const [exibido, setExibido] = React.useState(semMovimento ? valor : 0);

  React.useEffect(() => {
    if (semMovimento) {
      setExibido(valor);
      return;
    }
    const controles = animate(0, valor, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setExibido,
    });
    return () => controles.stop();
  }, [valor, semMovimento]);

  return (
    <span className={className} aria-label={moeda(valor, { oculto })}>
      <span aria-hidden>{moeda(exibido, { oculto })}</span>
    </span>
  );
}
