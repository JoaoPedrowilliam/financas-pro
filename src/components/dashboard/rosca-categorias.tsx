'use client';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Valor } from '@/components/shared/valor';
import { DicaGrafico } from './dica-grafico';

/**
 * Rampa sequencial de um matiz só, do mais escuro (maior fatia) ao mais claro.
 * Partes de um todo se leem por tamanho: oito matizes diferentes só acrescentariam
 * ruído e obrigariam o olho a voltar na legenda a cada fatia.
 */
const RAMPA = [
  'hsl(var(--graf-1))', 'hsl(var(--graf-2))', 'hsl(var(--graf-3))',
  'hsl(var(--graf-4))', 'hsl(var(--graf-5))', 'hsl(var(--graf-6))',
];
const RESTO = 'hsl(var(--graf-resto))';

export function RoscaCategorias({
  dados,
  oculto,
}: {
  dados: { nome: string; valor: number; cor?: string }[];
  oculto: boolean;
}) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const principais = dados.slice(0, 6);
  const resto = dados.slice(6);
  const fatias = resto.length
    ? [...principais, { nome: `Outras ${resto.length}`, valor: resto.reduce((s, d) => s + d.valor, 0) }]
    : principais;

  const corDaFatia = (i: number) => (i >= principais.length ? RESTO : RAMPA[i % RAMPA.length]);

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative mx-auto size-[164px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={fatias}
              dataKey="valor"
              nameKey="nome"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={2}
              // O anel na cor da superfície é o respiro entre fatias vizinhas.
              stroke="hsl(var(--surface-raised))"
              strokeWidth={2}
            >
              {fatias.map((f, i) => (
                <Cell key={f.nome} fill={corDaFatia(i)} />
              ))}
            </Pie>
            <Tooltip content={<DicaGrafico oculto={oculto} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-ink-faint">Total</span>
          <Valor valor={total} compacto className="font-display text-[17px] font-semibold" />
        </div>
      </div>

      {/* A legenda carrega nome, participação e valor: a cor não é a única pista. */}
      <ul className="min-w-0 flex-1 space-y-2.5">
        {fatias.map((f, i) => (
          <li key={f.nome} className="flex items-center gap-2.5 text-[13px]">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: corDaFatia(i) }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-ink-muted">{f.nome}</span>
            <span className="cifra shrink-0 text-[11px] text-ink-faint">
              {total > 0 ? `${((f.valor / total) * 100).toFixed(0)}%` : '0%'}
            </span>
            <Valor valor={f.valor} compacto className="w-[74px] shrink-0 text-right font-medium" />
          </li>
        ))}
      </ul>
    </div>
  );
}
