'use client';

import * as React from 'react';
import { CalendarRange, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Valor } from '@/components/shared/valor';
import type { ProjecaoMes } from '@/lib/financas';
import { moeda } from '@/lib/format';
import { MESES } from '@/lib/utils';

/**
 * Projeção de fechamento do mês.
 *
 * A barra separa as três camadas de certeza em vez de mostrar um número só:
 * o que já saiu, o que já tem dono e o que é palpite. Misturar as três num
 * total único faz a estimativa parecer tão firme quanto o extrato — e é
 * justamente a parte estimada que o usuário precisa poder descontar.
 */

const CAMADAS = [
  {
    chave: 'realizado' as const,
    rotulo: 'Já saiu',
    cor: 'hsl(var(--coral))',
    explicacao: 'Despesas que você já marcou como pagas neste mês.',
  },
  {
    chave: 'comprometido' as const,
    rotulo: 'Já tem dono',
    cor: 'hsl(var(--ambar))',
    explicacao:
      'Ainda não saiu, mas já está contratado: parcelas que vão cair, contas fixas, assinaturas e lançamentos pendentes.',
  },
  {
    chave: 'estimado' as const,
    rotulo: 'Estimativa',
    cor: 'hsl(var(--aco))',
    explicacao:
      'Extrapolação do seu gasto avulso no ritmo atual até o fim do mês. É a única parte que é palpite.',
  },
];

const CONFIANCA = {
  alta: { tom: 'positivo' as const, texto: 'projeção confiável' },
  media: { tom: 'aviso' as const, texto: 'confiança média' },
  baixa: { tom: 'critico' as const, texto: 'mês ainda no começo' },
};

export function ProjecaoGastos({
  projecao,
  proximos,
  gastoMesAnterior,
}: {
  projecao: ProjecaoMes;
  proximos: ProjecaoMes[];
  gastoMesAnterior: number;
}) {
  const { situacao, projetado, sobraProjetada, confianca } = projecao;
  const total = Math.max(projetado, 1);
  const vaiEstourar = sobraProjetada < 0;
  const diferenca = projetado - gastoMesAnterior;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>
              {situacao === 'passado' ? 'Quanto você gastou' : 'Quanto você vai gastar'}
            </CardTitle>
            <CardDescription>
              {situacao === 'corrente'
                ? `No ritmo de hoje, somando o que já está contratado. Dia ${projecao.diasDecorridos} de ${projecao.diasNoMes}.`
                : situacao === 'futuro'
                  ? 'Piso do mês: só o que já está contratado, sem contar gasto novo.'
                  : 'Mês fechado — estes são os números reais.'}
            </CardDescription>
          </div>
          {situacao === 'corrente' && (
            <Badge tom={CONFIANCA[confianca].tom}>{CONFIANCA[confianca].texto}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Valor
              valor={projetado}
              className="font-display text-[34px] font-semibold tracking-tight"
            />
            {gastoMesAnterior > 0 && (
              <span
                className={`inline-flex items-center gap-1 text-[13px] font-medium ${
                  diferenca > 0 ? 'text-coral' : 'text-cedula'
                }`}
              >
                {diferenca > 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {diferenca > 0 ? '+' : ''}
                {moeda(diferenca)} vs. mês passado
              </span>
            )}
          </div>

          {situacao !== 'passado' && (
            <p className="mt-1.5 text-[13px] text-ink-muted">
              {vaiEstourar ? (
                <>
                  Fecha <strong className="font-semibold text-coral">{moeda(Math.abs(sobraProjetada))}</strong>{' '}
                  acima do que deve entrar.
                </>
              ) : (
                <>
                  Sobram <strong className="font-semibold text-cedula-ink">{moeda(sobraProjetada)}</strong>{' '}
                  da receita prevista de {moeda(projecao.receitaProjetada)}.
                </>
              )}
            </p>
          )}
        </div>

        {/* Barra empilhada: a proporção entre fato e palpite fica visível. */}
        <div>
          <div
            className="flex h-3 w-full overflow-hidden rounded-pill bg-surface-sunken"
            role="img"
            aria-label={CAMADAS.map(
              (c) => `${c.rotulo}: ${moeda(projecao[c.chave])}`,
            ).join('. ')}
          >
            {CAMADAS.map((c) => {
              const valor = projecao[c.chave];
              if (valor <= 0) return null;
              return (
                <div
                  key={c.chave}
                  style={{ width: `${(valor / total) * 100}%`, background: c.cor }}
                  className="h-full first:rounded-l-pill last:rounded-r-pill"
                />
              );
            })}
          </div>

          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {CAMADAS.map((c) => {
              const valor = projecao[c.chave];
              return (
                <li key={c.chave} className="flex items-start gap-2">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: c.cor }}
                  />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-[11.5px] text-ink-muted">
                      {c.rotulo}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`O que entra em "${c.rotulo}"`}
                            className="text-ink-faint transition-colors hover:text-ink"
                          >
                            <Info className="size-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{c.explicacao}</TooltipContent>
                      </Tooltip>
                    </p>
                    <Valor valor={valor} className="block text-[14px] font-semibold" />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {situacao === 'corrente' && projecao.mediaDiaria > 0 && (
          <p className="rounded-control bg-surface-sunken px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
            Seu gasto avulso está em{' '}
            <strong className="cifra font-semibold text-ink">{moeda(projecao.mediaDiaria)}</strong> por
            dia. Contas fixas e parcelas ficam de fora dessa média — elas já entram inteiras na faixa
            amarela.
          </p>
        )}

        {proximos.length > 0 && (
          <div className="border-t border-line pt-4">
            <p className="flex items-center gap-1.5 text-[13px] font-medium">
              <CalendarRange className="size-4 text-ink-faint" />
              Já contratado para os próximos meses
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {proximos.map((p) => {
                const [ano, mes] = p.competencia.split('-').map(Number);
                const maior = Math.max(...proximos.map((x) => x.projetado), 1);
                return (
                  <li key={p.competencia} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[12.5px] text-ink-muted">
                      {MESES[mes - 1]}
                      {ano !== new Date().getFullYear() ? ` ${ano}` : ''}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
                      <span
                        className="block h-full rounded-pill bg-ambar"
                        style={{ width: `${(p.projetado / maior) * 100}%` }}
                      />
                    </span>
                    <Valor valor={p.projetado} className="w-24 shrink-0 text-right text-[13px] font-medium" />
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11.5px] text-ink-faint">
              É o piso de cada mês: contas fixas, parcelas e assinaturas já contratadas. Gasto novo
              entra por cima.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
