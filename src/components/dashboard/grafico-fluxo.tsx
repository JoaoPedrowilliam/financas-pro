'use client';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { moeda } from '@/lib/format';
import { MESES_CURTOS } from '@/lib/utils';
import type { ResumoMes } from '@/lib/financas';
import { DicaGrafico } from './dica-grafico';

/**
 * Receitas x despesas com a linha de economia por cima.
 * Barras para o que é comparável entre si; linha para a sobra, que é derivada delas.
 *
 * Verde e vermelho aqui não têm a mesma luminosidade de propósito: matiz sozinho
 * não separa as duas barras para quem tem daltonismo vermelho-verde — o degrau de
 * claro/escuro separa. A legenda e a tooltip fecham a identificação.
 */
export function GraficoFluxo({ dados, oculto }: { dados: ResumoMes[]; oculto: boolean }) {
  const pontos = dados.map((m) => ({
    mes: MESES_CURTOS[Number(m.competencia.split('-')[1]) - 1],
    Receitas: m.receitas,
    Despesas: m.despesas,
    Economia: m.economia,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={pontos}
        margin={{ top: 8, right: 6, bottom: 0, left: -14 }}
        barGap={2}
        barCategoryGap="22%"
      >
        <CartesianGrid vertical={false} stroke="hsl(var(--line))" />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={4}
          tick={{ fontSize: 11, fill: 'hsl(var(--ink-faint))' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={58}
          tickCount={5}
          tick={{ fontSize: 11, fill: 'hsl(var(--ink-faint))' }}
          tickFormatter={(v) => (oculto ? '•••' : moeda(v, { compacto: true }))}
        />
        <Tooltip
          content={<DicaGrafico oculto={oculto} />}
          cursor={{ fill: 'hsl(var(--ink) / 0.06)' }}
        />
        <Legend
          verticalAlign="top"
          align="left"
          height={30}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: 'hsl(var(--ink-muted))', paddingLeft: 14 }}
        />
        <Bar dataKey="Receitas" fill="hsl(var(--graf-receita))" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="Despesas" fill="hsl(var(--graf-despesa))" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Line
          type="monotone"
          dataKey="Economia"
          stroke="hsl(var(--graf-economia))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--surface-raised))' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
