'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Download, TrendingDown, TrendingUp } from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { Confirmar } from '@/components/shared/confirmar';
import { Valor } from '@/components/shared/valor';
import { TabelaTransacoes } from '@/components/transacoes/tabela-transacoes';
import { DialogTransacao } from '@/components/transacoes/dialog-transacao';
import { RoscaCategorias } from '@/components/dashboard/rosca-categorias';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { useFinancas } from '@/store/use-financas';
import { gastoPorCategoria, resumoDoMes, transacoesDoMes } from '@/lib/financas';
import { exportarTransacoesCSV } from '@/lib/exportar';
import { moeda, percentual } from '@/lib/format';
import { MESES, SLUGS_MES, competenciaDe, variacao } from '@/lib/utils';
import type { Transacao } from '@/types';

export function MesDetalhado({ mes }: { mes: number }) {
  return (
    <React.Suspense fallback={null}>
      <Conteudo mes={mes} />
    </React.Suspense>
  );
}

function Conteudo({ mes }: { mes: number }) {
  const router = useRouter();
  const parametros = useSearchParams();

  // Ano vem da query string. Valor ausente ou absurdo cai no ano corrente.
  const bruto = Number(parametros.get('ano'));
  const ano =
    Number.isInteger(bruto) && bruto >= 1970 && bruto <= 2200 ? bruto : new Date().getFullYear();

  const { transacoes, categorias, contas, cartoes, perfil, removeTransacao, removeGrupoParcelas } =
    useFinancas();

  const [editando, setEditando] = React.useState<Transacao | null>(null);
  const [dialogAberto, setDialogAberto] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState<Transacao | null>(null);

  const comp = competenciaDe(ano, mes);
  const compAnterior = mes === 1 ? competenciaDe(ano - 1, 12) : competenciaDe(ano, mes - 1);
  const compAnoPassado = competenciaDe(ano - 1, mes);

  const atual = React.useMemo(() => resumoDoMes(transacoes, comp), [transacoes, comp]);
  const anterior = React.useMemo(() => resumoDoMes(transacoes, compAnterior), [transacoes, compAnterior]);
  const anoPassado = React.useMemo(
    () => resumoDoMes(transacoes, compAnoPassado),
    [transacoes, compAnoPassado],
  );

  const doMes = React.useMemo(() => transacoesDoMes(transacoes, comp), [transacoes, comp]);

  const categoriasDoMes = React.useMemo(
    () =>
      gastoPorCategoria(transacoes, categorias, comp).map((c) => ({
        nome: c.categoria?.nome ?? 'Sem categoria',
        valor: c.total,
        cor: c.categoria?.cor,
      })),
    [transacoes, categorias, comp],
  );

  // Comparativo por categoria contra o mês anterior — onde o gasto realmente mudou.
  const variacaoCategorias = React.useMemo(() => {
    const agora = gastoPorCategoria(transacoes, categorias, comp);
    const antes = gastoPorCategoria(transacoes, categorias, compAnterior);
    return agora
      .map((linha) => {
        const par = antes.find((a) => a.categoria?.id === linha.categoria?.id);
        return {
          nome: linha.categoria?.nome ?? 'Sem categoria',
          cor: linha.categoria?.cor,
          atual: linha.total,
          anterior: par?.total ?? 0,
          delta: linha.total - (par?.total ?? 0),
          variacao: variacao(linha.total, par?.total ?? 0),
        };
      })
      .filter((l) => Math.abs(l.delta) > 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6);
  }, [transacoes, categorias, comp, compAnterior]);

  const irPara = (passo: number) => {
    const alvo = new Date(ano, mes - 1 + passo, 1);
    router.push(`/financas/${SLUGS_MES[alvo.getMonth()]}?ano=${alvo.getFullYear()}`);
  };

  const exportar = () => {
    exportarTransacoesCSV(
      doMes,
      (id) => categorias.find((c) => c.id === id)?.nome ?? 'Sem categoria',
      (id) => contas.find((c) => c.id === id)?.nome ?? cartoes.find((c) => c.id === id)?.nome ?? '—',
      `lancamentos-${comp}.csv`,
    );
    toast.success(`${doMes.length} lançamentos exportados`);
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={`${MESES[mes - 1]} de ${ano}`}
        descricao={`${atual.quantidade} ${atual.quantidade === 1 ? 'lançamento' : 'lançamentos'} no mês, comparados com ${MESES[Number(compAnterior.split('-')[1]) - 1].toLowerCase()}.`}
        acoes={
          <>
            <Button variant="contorno" size="icone" onClick={() => irPara(-1)} aria-label="Mês anterior">
              <ArrowLeft />
            </Button>
            <Button variant="contorno" size="icone" onClick={() => irPara(1)} aria-label="Próximo mês">
              <ArrowRight />
            </Button>
            <Button variant="contorno" onClick={exportar} disabled={!doMes.length}>
              <Download />
              Exportar
            </Button>
            <Button asChild variant="fantasma">
              <Link href="/financas">Ver tudo</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Comparativo
          rotulo="Receitas"
          valor={atual.receitas}
          contraMesAnterior={variacao(atual.receitas, anterior.receitas)}
          contraAnoPassado={variacao(atual.receitas, anoPassado.receitas)}
          tom="positivo"
        />
        <Comparativo
          rotulo="Despesas"
          valor={atual.despesas}
          contraMesAnterior={variacao(atual.despesas, anterior.despesas)}
          contraAnoPassado={variacao(atual.despesas, anoPassado.despesas)}
          tom="critico"
          inverterCor
        />
        <Comparativo
          rotulo="Sobrou no mês"
          valor={atual.economia}
          contraMesAnterior={variacao(atual.economia, anterior.economia)}
          contraAnoPassado={variacao(atual.economia, anoPassado.economia)}
          tom={atual.economia >= 0 ? 'positivo' : 'critico'}
          nota={
            atual.taxaEconomia !== null
              ? `${atual.taxaEconomia.toFixed(0)}% do que entrou`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
            <CardDescription>Como o mês se dividiu.</CardDescription>
          </CardHeader>
          <CardContent>
            {categoriasDoMes.length ? (
              <RoscaCategorias dados={categoriasDoMes} oculto={perfil.ocultarValores} />
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">Sem despesas neste mês.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>O que mudou desde o mês passado</CardTitle>
            <CardDescription>As categorias com maior diferença, para cima ou para baixo.</CardDescription>
          </CardHeader>
          <CardContent>
            {variacaoCategorias.length ? (
              <ul className="space-y-3">
                {variacaoCategorias.map((l) => {
                  const maior = Math.max(...variacaoCategorias.map((x) => Math.abs(x.delta)));
                  return (
                    <li key={l.nome}>
                      <div className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: l.cor ?? 'hsl(var(--ink-faint))' }}
                          />
                          <span className="truncate">{l.nome}</span>
                        </span>
                        <span
                          className={`cifra shrink-0 font-medium ${l.delta > 0 ? 'text-coral' : 'text-cedula'}`}
                        >
                          {l.delta > 0 ? '+' : ''}
                          {moeda(l.delta)}
                        </span>
                      </div>
                      <Progress
                        valor={(Math.abs(l.delta) / maior) * 100}
                        cor={l.delta > 0 ? 'hsl(var(--coral))' : 'hsl(var(--cedula))'}
                        className="mt-1.5 h-1.5"
                        rotulo={`Variação de ${l.nome}`}
                      />
                      <p className="mt-1 text-[11.5px] text-ink-faint">
                        {moeda(l.anterior)} → {moeda(l.atual)}
                        {l.variacao !== null ? ` · ${percentual(l.variacao, 0)}` : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">
                Sem diferenças relevantes contra o mês anterior.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {doMes.length ? (
          <TabelaTransacoes
            transacoes={doMes}
            onEditar={(t) => {
              setEditando(t);
              setDialogAberto(true);
            }}
            onExcluir={setExcluindo}
          />
        ) : (
          <EstadoVazio
            icone={TrendingUp}
            titulo={`Nada lançado em ${MESES[mes - 1].toLowerCase()}`}
            descricao="Registre uma entrada ou saída deste mês, ou navegue para outro período usando as setas acima."
          />
        )}
      </Card>

      <DialogTransacao aberto={dialogAberto} onAbertoChange={setDialogAberto} transacao={editando} />

      <Confirmar
        aberto={Boolean(excluindo)}
        onAbertoChange={(v) => !v && setExcluindo(null)}
        titulo={excluindo?.parcela ? `Excluir as ${excluindo.parcela.total} parcelas?` : 'Excluir este lançamento?'}
        descricao={
          excluindo?.parcela
            ? 'Todas as parcelas dessa compra serão removidas, inclusive as de outros meses.'
            : 'O lançamento sai do histórico e dos totais. Isso não pode ser desfeito.'
        }
        rotuloConfirmar={excluindo?.parcela ? 'Excluir todas' : 'Excluir'}
        onConfirmar={() => {
          if (!excluindo) return;
          if (excluindo.parcela) {
            removeGrupoParcelas(excluindo.parcela.grupoId);
            toast.success('Parcelas excluídas');
          } else {
            removeTransacao(excluindo.id);
            toast.success('Lançamento excluído');
          }
        }}
      />
    </div>
  );
}

function Comparativo({
  rotulo,
  valor,
  contraMesAnterior,
  contraAnoPassado,
  tom,
  nota,
  inverterCor,
}: {
  rotulo: string;
  valor: number;
  contraMesAnterior: number | null;
  contraAnoPassado: number | null;
  tom: 'positivo' | 'critico';
  nota?: string;
  /** Em despesas, subir é ruim: a cor da variação inverte. */
  inverterCor?: boolean;
}) {
  const corVariacao = (v: number | null) => {
    if (v === null) return 'text-ink-faint';
    const bom = inverterCor ? v < 0 : v > 0;
    return bom ? 'text-cedula' : 'text-coral';
  };

  return (
    <div className="painel p-4">
      <p className="text-[12px] text-ink-muted">{rotulo}</p>
      <Valor
        valor={valor}
        className={`mt-1 block font-display text-[24px] font-semibold ${
          tom === 'critico' && valor !== 0 ? 'text-coral' : ''
        }`}
      />
      {nota ? <p className="text-[11.5px] text-ink-faint">{nota}</p> : null}
      <div className="mt-3 space-y-1 border-t border-line pt-2.5 text-[11.5px]">
        <div className="flex justify-between">
          <span className="text-ink-muted">vs. mês anterior</span>
          <span className={`cifra font-medium ${corVariacao(contraMesAnterior)}`}>
            {percentual(contraMesAnterior, 0)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">vs. ano passado</span>
          <span className={`cifra font-medium ${corVariacao(contraAnoPassado)}`}>
            {percentual(contraAnoPassado, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
