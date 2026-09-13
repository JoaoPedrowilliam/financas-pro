'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download, FileBarChart, FileText } from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { Valor } from '@/components/shared/valor';
import { GraficoFluxo } from '@/components/dashboard/grafico-fluxo';
import { DicaGrafico } from '@/components/dashboard/dica-grafico';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { useFinancas } from '@/store/use-financas';
import {
  gastoPorCategoria, patrimonioLiquido, resultadoCarteira, serieAnual, transacoesDoMes,
} from '@/lib/financas';
import { gerarPDF, exportarTransacoesCSV, linhasDeTransacoes } from '@/lib/exportar';
import { moeda, percentual } from '@/lib/format';
import { MESES, MESES_CURTOS, competenciaDe, somar, variacao } from '@/lib/utils';

export default function PaginaRelatorios() {
  const estado = useFinancas();
  const { transacoes, categorias, contas, cartoes, perfil, dividas, metas, ativos } = estado;

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = React.useState(anoAtual);
  const [gerando, setGerando] = React.useState(false);

  const anosDisponiveis = React.useMemo(() => {
    const anos = new Set(transacoes.map((t) => Number(t.data.slice(0, 4))));
    anos.add(anoAtual);
    return Array.from(anos).sort((a, b) => b - a);
  }, [transacoes, anoAtual]);

  const serie = React.useMemo(() => serieAnual(transacoes, ano), [transacoes, ano]);
  const serieAnterior = React.useMemo(() => serieAnual(transacoes, ano - 1), [transacoes, ano - 1]);

  const totalReceitas = somar(serie, (m) => m.receitas);
  const totalDespesas = somar(serie, (m) => m.despesas);
  const totalEconomia = totalReceitas - totalDespesas;
  const receitasAnterior = somar(serieAnterior, (m) => m.receitas);
  const despesasAnterior = somar(serieAnterior, (m) => m.despesas);

  const doAno = React.useMemo(
    () => transacoes.filter((t) => t.data.startsWith(String(ano))),
    [transacoes, ano],
  );

  const categoriasAno = React.useMemo(() => {
    const base = doAno.filter((t) => t.tipo === 'despesa');
    return gastoPorCategoria(base, categorias).slice(0, 10);
  }, [doAno, categorias]);

  const melhorMes = serie.reduce((a, b) => (b.economia > a.economia ? b : a), serie[0]);
  const piorMes = serie.reduce((a, b) => (b.economia < a.economia ? b : a), serie[0]);
  const mediaMensal = totalDespesas / Math.max(1, serie.filter((m) => m.quantidade > 0).length);

  const nomeCategoria = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nome ?? 'Sem categoria';

  const exportarCSV = () => {
    exportarTransacoesCSV(
      doAno,
      nomeCategoria,
      (id) => contas.find((c) => c.id === id)?.nome ?? cartoes.find((c) => c.id === id)?.nome ?? '—',
      `lancamentos-${ano}.csv`,
    );
    toast.success(`${doAno.length} lançamentos exportados`);
  };

  const exportarPDF = async () => {
    setGerando(true);
    try {
      const patrimonio = patrimonioLiquido(estado);
      const carteira = resultadoCarteira(ativos);

      await gerarPDF({
        titulo: `Relatório anual · ${ano}`,
        subtitulo: `${perfil.nome || 'Finanças Pro'} — gerado em ${new Date().toLocaleString('pt-BR')}`,
        resumo: [
          { rotulo: 'Receitas', valor: moeda(totalReceitas) },
          { rotulo: 'Despesas', valor: moeda(totalDespesas) },
          { rotulo: 'Economia', valor: moeda(totalEconomia) },
          { rotulo: 'Patrimônio', valor: moeda(patrimonio.total) },
        ],
        secoes: [
          {
            titulo: 'Resumo mês a mês',
            colunas: ['Mês', 'Receitas', 'Despesas', 'Economia', 'Taxa'],
            linhas: serie.map((m, i) => [
              MESES[i],
              moeda(m.receitas),
              moeda(m.despesas),
              moeda(m.economia),
              m.taxaEconomia !== null ? `${m.taxaEconomia.toFixed(0)}%` : '—',
            ]),
          },
          {
            titulo: 'Maiores despesas por categoria',
            colunas: ['Categoria', 'Total', 'Participação', 'Lançamentos'],
            linhas: categoriasAno.map((c) => [
              c.categoria?.nome ?? 'Sem categoria',
              moeda(c.total),
              `${c.participacao.toFixed(1)}%`,
              String(c.quantidade),
            ]),
          },
          {
            titulo: 'Posição patrimonial',
            colunas: ['Item', 'Valor'],
            linhas: [
              ['Saldo em contas', moeda(patrimonio.contas)],
              ['Investimentos a mercado', moeda(patrimonio.investimentos)],
              ['Resultado da carteira', moeda(carteira.lucro)],
              ['Dívidas em aberto', moeda(-patrimonio.dividas)],
              ['Patrimônio líquido', moeda(patrimonio.total)],
            ],
          },
          ...(dividas.filter((d) => d.status !== 'quitada').length
            ? [
                {
                  titulo: 'Dívidas em aberto',
                  colunas: ['Credor', 'Saldo', 'Juros ao mês', 'Situação'],
                  linhas: dividas
                    .filter((d) => d.status !== 'quitada')
                    .map((d) => [
                      d.credor,
                      moeda(d.valorAcordo ?? d.saldoAtual),
                      `${d.jurosMes.toFixed(1)}%`,
                      d.negativado ? `negativado (${d.orgao})` : d.status,
                    ]),
                },
              ]
            : []),
          ...(metas.length
            ? [
                {
                  titulo: 'Metas',
                  colunas: ['Meta', 'Guardado', 'Objetivo', 'Progresso'],
                  linhas: metas.map((m) => [
                    m.nome,
                    moeda(m.valorAtual),
                    moeda(m.valorAlvo),
                    `${((m.valorAtual / Math.max(1, m.valorAlvo)) * 100).toFixed(0)}%`,
                  ]),
                },
              ]
            : []),
          linhasDeTransacoes(
            doAno.slice().sort((a, b) => a.data.localeCompare(b.data)),
            nomeCategoria,
          ),
        ],
        arquivo: `relatorio-financeiro-${ano}.pdf`,
      });

      toast.success('Relatório gerado');
    } catch (erro) {
      toast.error('Não foi possível gerar o PDF', {
        description: erro instanceof Error ? erro.message : 'Tente novamente.',
      });
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Relatórios"
        descricao="O ano inteiro em um lugar, com comparativo contra o anterior e exportação para PDF ou planilha."
        acoes={
          <>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="contorno" onClick={exportarCSV} disabled={!doAno.length}>
              <Download />
              CSV
            </Button>
            <Button onClick={exportarPDF} disabled={gerando || !doAno.length}>
              <FileText />
              {gerando ? 'Gerando…' : 'Relatório em PDF'}
            </Button>
          </>
        }
      />

      {doAno.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={FileBarChart}
            titulo={`Nenhum lançamento em ${ano}`}
            descricao="Escolha outro ano no seletor acima ou registre lançamentos para este período."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metrica
              rotulo="Receitas no ano"
              valor={totalReceitas}
              variacao={variacao(totalReceitas, receitasAnterior)}
            />
            <Metrica
              rotulo="Despesas no ano"
              valor={totalDespesas}
              variacao={variacao(totalDespesas, despesasAnterior)}
              inverterCor
            />
            <Metrica
              rotulo="Economia acumulada"
              valor={totalEconomia}
              nota={
                totalReceitas > 0
                  ? `${((totalEconomia / totalReceitas) * 100).toFixed(0)}% da renda`
                  : undefined
              }
            />
            <Metrica rotulo="Gasto médio por mês" valor={mediaMensal} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Entradas e saídas em {ano}</CardTitle>
              <CardDescription>Barras comparam receita e despesa; a linha é o que sobrou.</CardDescription>
            </CardHeader>
            <CardContent>
              <GraficoFluxo dados={serie} oculto={perfil.ocultarValores} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Economia por mês</CardTitle>
                <CardDescription>
                  Meses em coral fecharam no vermelho — gastaram mais do que entrou.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={serie.map((m, i) => ({ mes: MESES_CURTOS[i], Economia: m.economia }))}
                    margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
                  >
                    <CartesianGrid vertical={false} stroke="hsl(var(--line))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="mes"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--ink-faint))' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={64}
                      tick={{ fontSize: 11, fill: 'hsl(var(--ink-faint))' }}
                      tickFormatter={(v) => (perfil.ocultarValores ? '•••' : moeda(v, { compacto: true }))}
                    />
                    <Tooltip
                      content={<DicaGrafico oculto={perfil.ocultarValores} />}
                      cursor={{ fill: 'hsl(var(--surface-sunken))' }}
                    />
                    <Bar dataKey="Economia" radius={[5, 5, 0, 0]} maxBarSize={32}>
                      {serie.map((m, i) => (
                        <Cell
                          key={i}
                          fill={m.economia >= 0 ? 'hsl(var(--cedula))' : 'hsl(var(--coral))'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-control border border-line p-3">
                    <p className="text-[11.5px] text-ink-muted">Melhor mês</p>
                    <p className="text-[13px] font-medium">
                      {MESES[Number(melhorMes.competencia.split('-')[1]) - 1]}
                    </p>
                    <Valor valor={melhorMes.economia} className="text-[13px] font-semibold text-cedula" />
                  </div>
                  <div className="rounded-control border border-line p-3">
                    <p className="text-[11.5px] text-ink-muted">Mês mais apertado</p>
                    <p className="text-[13px] font-medium">
                      {MESES[Number(piorMes.competencia.split('-')[1]) - 1]}
                    </p>
                    <Valor valor={piorMes.economia} className="text-[13px] font-semibold text-coral" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Onde o dinheiro foi no ano</CardTitle>
                <CardDescription>As dez categorias que mais pesaram.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {categoriasAno.map((c) => (
                    <li key={c.categoria?.id ?? 'sem'}>
                      <div className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{ background: c.categoria?.cor ?? 'hsl(var(--ink-faint))' }}
                          />
                          <span className="truncate">{c.categoria?.nome ?? 'Sem categoria'}</span>
                        </span>
                        <Valor valor={c.total} className="shrink-0 font-medium" />
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
                        <div
                          className="h-full rounded-pill"
                          style={{
                            width: `${c.participacao}%`,
                            background: c.categoria?.cor ?? 'hsl(var(--ink-faint))',
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {c.participacao.toFixed(1)}% das despesas · {c.quantidade} lançamentos ·{' '}
                        {moeda(c.total / 12)} por mês
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fechamento mês a mês</CardTitle>
              <CardDescription>O mesmo dado da tabela do PDF exportado.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scroll-fino">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-y border-line text-[11.5px] text-ink-muted">
                      <th className="px-5 py-2 text-left font-medium">Mês</th>
                      <th className="px-3 py-2 text-right font-medium">Receitas</th>
                      <th className="px-3 py-2 text-right font-medium">Despesas</th>
                      <th className="px-3 py-2 text-right font-medium">Economia</th>
                      <th className="px-5 py-2 text-right font-medium">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serie.map((m, i) => {
                      const vazio = m.quantidade === 0;
                      return (
                        <tr
                          key={m.competencia}
                          className={`border-b border-line last:border-0 ${vazio ? 'text-ink-faint' : ''}`}
                        >
                          <td className="px-5 py-2.5">{MESES[i]}</td>
                          <td className="px-3 py-2.5 text-right">
                            <Valor valor={m.receitas} />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Valor valor={m.despesas} />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Valor valor={m.economia} colorido />
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            {m.taxaEconomia !== null ? (
                              <Badge tom={m.taxaEconomia >= 20 ? 'positivo' : m.taxaEconomia >= 0 ? 'neutro' : 'critico'}>
                                {m.taxaEconomia.toFixed(0)}%
                              </Badge>
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line-strong font-semibold">
                      <td className="px-5 py-3">Total</td>
                      <td className="px-3 py-3 text-right">
                        <Valor valor={totalReceitas} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Valor valor={totalDespesas} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Valor valor={totalEconomia} colorido />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {totalReceitas > 0 ? `${((totalEconomia / totalReceitas) * 100).toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Metrica({
  rotulo,
  valor,
  variacao: v,
  nota,
  inverterCor,
}: {
  rotulo: string;
  valor: number;
  variacao?: number | null;
  nota?: string;
  inverterCor?: boolean;
}) {
  const cor =
    v === null || v === undefined
      ? 'text-ink-faint'
      : (inverterCor ? v < 0 : v > 0)
        ? 'text-cedula'
        : 'text-coral';

  return (
    <div className="painel p-4">
      <p className="text-[12px] text-ink-muted">{rotulo}</p>
      <Valor valor={valor} className="mt-1 block font-display text-[20px] font-semibold" />
      {v !== undefined && (
        <p className={`cifra mt-0.5 text-[11.5px] font-medium ${cor}`}>
          {percentual(v, 0)} <span className="font-normal text-ink-faint">vs. ano anterior</span>
        </p>
      )}
      {nota ? <p className="mt-0.5 text-[11.5px] text-ink-faint">{nota}</p> : null}
    </div>
  );
}
