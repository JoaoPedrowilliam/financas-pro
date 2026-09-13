'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CircleAlert, TrendingDown } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CampoValor } from '@/components/shared/campo-valor';
import { Valor } from '@/components/shared/valor';
import { DicaGrafico } from '@/components/dashboard/dica-grafico';
import { custoSeManter, parcelaParaPrazo, simularQuitacao } from '@/lib/financas';
import { moeda } from '@/lib/format';
import { useFinancas } from '@/store/use-financas';
import type { Divida } from '@/types';

const PRAZOS = [6, 12, 18, 24, 36];

/**
 * Simulador de quitação de uma dívida.
 *
 * A pergunta que ele responde não é "quanto vou pagar por mês", e sim
 * "quanto essa dívida ainda vai me custar se eu continuar como estou".
 * Por isso a economia contra o cenário de rolar a dívida fica em destaque.
 */
export function SimuladorQuitacao({
  aberto,
  onAbertoChange,
  divida,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  divida: Divida | null;
}) {
  const oculto = useFinancas((s) => s.perfil.ocultarValores);
  const [parcela, setParcela] = React.useState(0);

  const base = divida ? (divida.valorAcordo ?? divida.saldoAtual) : 0;

  React.useEffect(() => {
    if (!divida) return;
    // Começa numa parcela que quita em 12 meses — um ponto de partida realista.
    setParcela(parcelaParaPrazo(divida, 12));
  }, [divida]);

  const simulacao = React.useMemo(
    () => (divida && parcela > 0 ? simularQuitacao(divida, parcela) : null),
    [divida, parcela],
  );

  if (!divida) return null;

  const jurosMensais = base * (divida.jurosMes / 100);
  const inviavel = parcela > 0 && !simulacao;

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Simular a quitação de {divida.credor}</DialogTitle>
          <DialogDescription>
            {divida.valorAcordo
              ? `Cálculo sobre o acordo de ${moeda(divida.valorAcordo)}, com juros de ${divida.jurosMes}% ao mês.`
              : `Saldo de ${moeda(divida.saldoAtual)} com juros de ${divida.jurosMes}% ao mês.`}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="parcela-simulada">Quanto você consegue pagar por mês</Label>
          <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:w-48">
              <CampoValor id="parcela-simulada" value={parcela} onChange={setParcela} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRAZOS.map((meses) => (
                <Button
                  key={meses}
                  variant="contorno"
                  size="sm"
                  onClick={() => setParcela(parcelaParaPrazo(divida, meses))}
                >
                  Quitar em {meses}m
                </Button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[12px] text-ink-faint">
            Só os juros deste mês somam {moeda(jurosMensais)}. Qualquer parcela abaixo disso faz a
            dívida crescer.
          </p>
        </div>

        {inviavel ? (
          <div className="flex gap-3 rounded-control border border-coral/40 bg-coral-soft p-4">
            <CircleAlert className="size-5 shrink-0 text-coral" />
            <div>
              <p className="text-[13px] font-medium text-coral">Essa parcela não quita a dívida</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Pagando {moeda(parcela)} por mês você não cobre nem os {moeda(jurosMensais)} de juros — o
                saldo aumenta todo mês. Para começar a amortizar, a parcela precisa passar desse valor.
              </p>
            </div>
          </div>
        ) : simulacao ? (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Resultado rotulo="Tempo até quitar" texto={`${simulacao.meses} ${simulacao.meses === 1 ? 'mês' : 'meses'}`} />
              <Resultado rotulo="Total que você vai pagar" valor={simulacao.totalPago} />
              <Resultado rotulo="Só de juros" valor={simulacao.jurosPagos} tom="critico" />
              <Resultado
                rotulo="Economia vs. rolar a dívida"
                valor={simulacao.economiaVsManter}
                tom={simulacao.economiaVsManter > 0 ? 'positivo' : 'neutro'}
              />
            </div>

            <div className="rounded-control border border-line p-4">
              <div className="mb-3 flex items-center gap-2">
                <TrendingDown className="size-4 text-cedula" />
                <p className="text-[13px] font-medium">Como o saldo cai mês a mês</p>
                <Badge tom="neutro" className="ml-auto">
                  {moeda(parcela)}/mês
                </Badge>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={[{ mes: 0, saldo: base }, ...simulacao.cronograma]}
                  margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
                >
                  <defs>
                    <linearGradient id="grad-quitacao" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--cedula))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--cedula))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--line))" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--ink-faint))' }}
                    tickFormatter={(v) => `${v}m`}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tick={{ fontSize: 11, fill: 'hsl(var(--ink-faint))' }}
                    tickFormatter={(v) => (oculto ? '•••' : moeda(v, { compacto: true }))}
                  />
                  <Tooltip
                    content={<DicaGrafico oculto={oculto} />}
                    labelFormatter={(v) => `Mês ${v}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo devedor"
                    stroke="hsl(var(--cedula))"
                    strokeWidth={2}
                    fill="url(#grad-quitacao)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              Se nada mudar e a dívida seguir rolando, ela custaria{' '}
              <strong className="cifra font-semibold text-ink">{moeda(custoSeManter(divida))}</strong>.
              Quitando em {simulacao.meses} {simulacao.meses === 1 ? 'mês' : 'meses'}, sai por{' '}
              <strong className="cifra font-semibold text-ink">{moeda(simulacao.totalPago)}</strong>.
            </p>
          </>
        ) : null}

        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Resultado({
  rotulo,
  valor,
  texto,
  tom = 'neutro',
}: {
  rotulo: string;
  valor?: number;
  texto?: string;
  tom?: 'neutro' | 'positivo' | 'critico';
}) {
  const cor =
    tom === 'positivo' ? 'text-cedula-ink' : tom === 'critico' ? 'text-coral' : 'text-ink';
  return (
    <div className="rounded-control border border-line p-3">
      <p className="text-[11.5px] leading-tight text-ink-muted">{rotulo}</p>
      {texto ? (
        <p className={`cifra mt-1 font-display text-[17px] font-semibold ${cor}`}>{texto}</p>
      ) : (
        <Valor valor={valor ?? 0} className={`mt-1 block font-display text-[17px] font-semibold ${cor}`} />
      )}
    </div>
  );
}
