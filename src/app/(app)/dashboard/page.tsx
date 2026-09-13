'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { SeletorCompetencia } from '@/components/shared/seletor-competencia';
import { BlocoSaldo } from '@/components/dashboard/bloco-saldo';
import { Indicador } from '@/components/dashboard/indicador';
import { GraficoFluxo } from '@/components/dashboard/grafico-fluxo';
import { RoscaCategorias } from '@/components/dashboard/rosca-categorias';
import { PainelInsights } from '@/components/dashboard/painel-insights';
import { OrcamentoCategorias } from '@/components/dashboard/orcamento-categorias';
import { AcoesRapidas } from '@/components/dashboard/acoes-rapidas';
import { ResumoNarrativo } from '@/components/dashboard/resumo-narrativo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Valor } from '@/components/shared/valor';
import { useFinancas } from '@/store/use-financas';
import {
  evolucaoDiaria, gastoPorCategoria, orcamentoPorCategoria, patrimonioLiquido,
  progressoMeta, resumoDoMes, saldoTotal, serieAnual,
} from '@/lib/financas';
import { gerarInsights } from '@/lib/insights';
import { competenciaDe, mesAnterior, variacao } from '@/lib/utils';
import { competenciaLegivel, dataCurta, distanciaEmDias } from '@/lib/format';

export default function PaginaDashboard() {
  const estado = useFinancas();
  const hoje = new Date();
  const [comp, setComp] = React.useState(() => competenciaDe(hoje.getFullYear(), hoje.getMonth() + 1));
  const [ano] = comp.split('-').map(Number);

  const { transacoes, contas, perfil } = estado;

  const mes = React.useMemo(() => resumoDoMes(transacoes, comp), [transacoes, comp]);
  const anterior = React.useMemo(() => resumoDoMes(transacoes, mesAnterior(comp)), [transacoes, comp]);
  const serie = React.useMemo(() => serieAnual(transacoes, ano), [transacoes, ano]);
  const patrimonio = React.useMemo(() => patrimonioLiquido(estado), [estado]);
  const insights = React.useMemo(() => gerarInsights(estado), [estado]);

  const saldo = React.useMemo(() => saldoTotal(contas, transacoes), [contas, transacoes]);
  const sparkline = React.useMemo(
    () => evolucaoDiaria(transacoes, comp, saldo - mes.economia).map((d) => ({ valor: d.saldo })),
    [transacoes, comp, saldo, mes.economia],
  );

  const porCategoria = React.useMemo(
    () => gastoPorCategoria(transacoes, estado.categorias, comp),
    [transacoes, estado.categorias, comp],
  );
  const categorias = React.useMemo(
    () => porCategoria.map((c) => ({ nome: c.categoria?.nome ?? 'Sem categoria', valor: c.total })),
    [porCategoria],
  );
  const maiorCategoria = React.useMemo(() => {
    const linha = porCategoria.find((c) => c.categoria && c.total > 0);
    return linha?.categoria ? { nome: linha.categoria.nome, total: linha.total } : null;
  }, [porCategoria]);

  const orcamentos = React.useMemo(
    () => orcamentoPorCategoria(transacoes, estado.categorias, comp),
    [transacoes, estado.categorias, comp],
  );

  const proximas = React.useMemo(
    () =>
      transacoes
        .filter((t) => t.status !== 'pago' && t.tipo === 'despesa')
        .sort((a, b) => a.data.localeCompare(b.data))
        .slice(0, 5),
    [transacoes],
  );

  const metasAtivas = estado.metas.filter((m) => !m.concluida).slice(0, 3);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={`Olá, ${perfil.nome?.split(' ')[0] || 'tudo certo por aqui'}`}
        descricao={`Resumo de ${competenciaLegivel(comp).toLowerCase()}. Os números respondem ao mês selecionado.`}
        acoes={<SeletorCompetencia valor={comp} onChange={setComp} />}
      />

      {/* Leitura do mês em uma linha, antes dos números. Some da tela quando não há base. */}
      <ResumoNarrativo
        mes={mes}
        anterior={anterior}
        maiorCategoria={maiorCategoria}
        orcamentos={orcamentos}
        oculto={perfil.ocultarValores}
      />

      {/* Hierarquia: saldo grande à esquerda, indicadores compactos à direita. */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <BlocoSaldo
          saldo={saldo}
          variacaoMes={variacao(mes.economia, anterior.economia)}
          serie={sparkline}
          contexto={
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ink-muted">
              <span>
                Patrimônio líquido <Valor valor={patrimonio.total} className="font-semibold text-ink" />
              </span>
              <span>
                Investido <Valor valor={patrimonio.investimentos} className="font-semibold text-ink" />
              </span>
              {patrimonio.dividas > 0 && (
                <span>
                  Dívidas <Valor valor={-patrimonio.dividas} className="font-semibold text-coral" />
                </span>
              )}
            </div>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Indicador
            rotulo="Receitas do mês"
            valor={mes.receitas}
            variacao={variacao(mes.receitas, anterior.receitas)}
            icone={TrendingUp}
            tom="positivo"
            indice={0}
          />
          {/* Em despesa, subir é ruim: `variacaoInvertida` faz o verde/vermelho seguir o
              significado financeiro, não o sinal do número. */}
          <Indicador
            rotulo="Despesas do mês"
            valor={mes.despesas}
            variacao={variacao(mes.despesas, anterior.despesas)}
            variacaoInvertida
            icone={TrendingDown}
            tom="critico"
            indice={1}
          />
          <Indicador
            rotulo="Economia do mês"
            valor={mes.economia}
            icone={PiggyBank}
            tom={mes.economia >= 0 ? 'positivo' : 'critico'}
            nota={
              mes.taxaEconomia !== null
                ? `${mes.taxaEconomia.toFixed(0)}% do que entrou`
                : 'sem receita registrada'
            }
            indice={2}
          />
          <Indicador
            rotulo="Patrimônio líquido"
            valor={patrimonio.total}
            icone={Wallet}
            tom="neutro"
            nota="contas + investimentos − dívidas"
            indice={3}
          />
        </div>
      </div>

      <AcoesRapidas />

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Entradas e saídas em {ano}</CardTitle>
            <CardDescription>
              Verde entrou, vermelho saiu. A linha cinza é o que sobrou em cada mês — abaixo de zero,
              o mês fechou no vermelho.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GraficoFluxo dados={serie} oculto={perfil.ocultarValores} />
          </CardContent>
        </Card>

        <PainelInsights insights={insights} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Para onde foi o dinheiro</CardTitle>
            <CardDescription>Despesas de {competenciaLegivel(comp).toLowerCase()} por categoria.</CardDescription>
          </CardHeader>
          <CardContent>
            {categorias.length ? (
              <RoscaCategorias dados={categorias} oculto={perfil.ocultarValores} />
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">
                Nenhuma despesa registrada neste mês.
              </p>
            )}
          </CardContent>
        </Card>

        <OrcamentoCategorias linhas={orcamentos} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Próximos vencimentos</CardTitle>
            <CardDescription>Contas ainda em aberto, da mais próxima para a mais distante.</CardDescription>
          </CardHeader>
          <CardContent>
            {proximas.length ? (
              <ul className="space-y-2">
                {proximas.map((t) => {
                  const d = distanciaEmDias(t.data);
                  return (
                    <li key={t.id} className="flex items-center gap-3 rounded-control border border-line p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{t.descricao}</p>
                        <p className="text-[11.5px] text-ink-faint">
                          {dataCurta(t.data)} · {d.texto}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Valor valor={t.valor} className="block text-[13px] font-semibold" />
                        {d.dias < 0 && (
                          <Badge tom="critico" className="mt-0.5">
                            atrasada
                          </Badge>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">Nenhuma conta em aberto.</p>
            )}
            <Button asChild variant="contorno" size="sm" className="mt-4 w-full">
              <Link href="/contas">
                Ver todas as contas
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {metasAtivas.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Suas metas</CardTitle>
              <CardDescription>Quanto falta e o aporte mensal necessário para chegar no prazo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {metasAtivas.map((meta) => {
                const p = progressoMeta(meta);
                return (
                  <div key={meta.id} className="rounded-control border border-line p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-medium">{meta.nome}</p>
                      <span className="cifra shrink-0 text-[12px] text-ink-muted">
                        {p.percentual.toFixed(0)}%
                      </span>
                    </div>
                    <Progress valor={p.percentual} className="mt-3" rotulo={meta.nome} />
                    <p className="mt-2.5 text-[12px] text-ink-muted">
                      <Valor valor={meta.valorAtual} className="font-medium text-ink" /> de{' '}
                      <Valor valor={meta.valorAlvo} />
                    </p>
                    <p className="mt-1 text-[11.5px] text-ink-faint">
                      {p.atrasada
                        ? 'Prazo vencido'
                        : `Faltam ${p.mesesRestantes} ${p.mesesRestantes === 1 ? 'mês' : 'meses'}`}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
