'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Banknote, CalendarClock, Check, MoreVertical, Pencil, Plus, Receipt,
  RefreshCw, Repeat, Trash2, TriangleAlert,
} from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { SeletorCompetencia } from '@/components/shared/seletor-competencia';
import { Confirmar } from '@/components/shared/confirmar';
import { Valor } from '@/components/shared/valor';
import { DialogConta, DialogRecorrencia } from '@/components/contas/dialogs';
import { CartaoConta } from '@/components/contas/cartao-conta';
import { DicaGrafico } from '@/components/dashboard/dica-grafico';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFinancas } from '@/store/use-financas';
import { useAcao } from '@/lib/acoes';
import { mediaDaVariavel, saldoDaConta, saldoTotal } from '@/lib/financas';
import { lembretesDoMes } from '@/lib/insights';
import { dataCurta, moeda, percentual } from '@/lib/format';
import { MESES_CURTOS, competenciaDe, dataDe, somar } from '@/lib/utils';
import type { Conta, Recorrencia, Transacao } from '@/types';

export default function PaginaContas() {
  const estado = useFinancas();
  const {
    contas, transacoes, recorrencias, categorias, perfil,
    removeConta, removeRecorrencia, updateRecorrencia, alternarStatus, addTransacao,
    gerarLancamentosDoMes,
  } = estado;

  const { executando, executar } = useAcao();

  const hoje = new Date();
  const [comp, setComp] = React.useState(() => competenciaDe(hoje.getFullYear(), hoje.getMonth() + 1));
  const [contaDialog, setContaDialog] = React.useState(false);
  const [recDialog, setRecDialog] = React.useState(false);
  const [natureza, setNatureza] = React.useState<Recorrencia['natureza']>('fixa');
  const [contaEditando, setContaEditando] = React.useState<Conta | null>(null);
  const [recEditando, setRecEditando] = React.useState<Recorrencia | null>(null);
  const [excluirConta, setExcluirConta] = React.useState<Conta | null>(null);
  const [excluirRec, setExcluirRec] = React.useState<Recorrencia | null>(null);

  const fixas = recorrencias.filter((r) => r.natureza === 'fixa');
  const variaveis = recorrencias.filter((r) => r.natureza === 'variavel');

  const lembretes = React.useMemo(() => lembretesDoMes(estado, comp), [estado, comp]);
  const aPagar = lembretes.filter((l) => !l.pago);
  const totalAPagar = somar(aPagar, (l) => l.lancamento?.valor ?? l.recorrencia.valorPrevisto);

  const totalFixas = somar(fixas.filter((r) => r.ativa && r.tipo === 'despesa'), (r) => r.valorPrevisto);
  const mediasVariaveis = React.useMemo(
    () =>
      variaveis.map((rec) => ({ rec, analise: mediaDaVariavel(rec, transacoes, 6) })),
    [variaveis, transacoes],
  );
  const totalVariaveis = somar(mediasVariaveis, (v) => v.analise.media);

  const saldo = saldoTotal(contas, transacoes);

  const novaRecorrencia = (n: Recorrencia['natureza']) => {
    setNatureza(n);
    setRecEditando(null);
    setRecDialog(true);
  };

  /**
   * Marca a conta do mês como paga pelo círculo da lista.
   *
   * Quando o lançamento já existe, só alterna o status. Quando não existe — a
   * recorrência vence no mês mas ninguém clicou em "Gerar lançamentos" —, cria
   * o lançamento já pago. Antes disso o botão ficava desabilitado e a pessoa
   * via a conta na lista sem conseguir dar baixa nela.
   */
  const marcarPagamento = async (
    rec: Recorrencia,
    lancamento: Transacao | undefined,
    data: string,
  ) => {
    if (lancamento) {
      await executar(() => alternarStatus(lancamento.id), {
        aoFalhar: 'Não foi possível mudar o status',
      });
      return;
    }

    await executar(
      async () => {
        await addTransacao({
          tipo: rec.tipo,
          descricao: rec.nome,
          // Nas variáveis o previsto é estimativa; a pessoa ajusta o valor
          // depois em Finanças, quando a conta chegar.
          valor: rec.valorPrevisto,
          data,
          categoriaId: rec.categoriaId,
          contaId: rec.cartaoId ? null : rec.contaId,
          cartaoId: rec.cartaoId ?? null,
          status: 'pago',
          etiquetas: [rec.natureza === 'fixa' ? 'conta fixa' : 'conta variável'],
          anexos: [],
          recorrenciaId: rec.id,
        });
        toast.success(`${rec.nome} marcada como paga`);
      },
      { aoFalhar: 'Não foi possível registrar o pagamento' },
    );
  };

  const gerar = async () => {
    // A contagem só é conhecida depois que o banco responde; o aviso espera.
    await executar(
      async () => {
        const criados = await gerarLancamentosDoMes(comp);
        toast.success(
          criados > 0
            ? `${criados} ${criados === 1 ? 'lançamento gerado' : 'lançamentos gerados'}`
            : 'Este mês já estava gerado',
          {
            description:
              criados > 0 ? 'Eles entram como pendentes até você confirmar o pagamento.' : undefined,
          },
        );
      },
      { aoFalhar: 'Não foi possível gerar os lançamentos' },
    );
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Contas"
        descricao="Suas contas bancárias, as despesas fixas do mês e as variáveis que precisam de acompanhamento."
        acoes={
          <>
            <SeletorCompetencia valor={comp} onChange={setComp} />
            <Button variant="contorno" onClick={gerar} disabled={executando}>
              <RefreshCw className={executando ? 'animate-spin' : undefined} />
              {executando ? 'Gerando…' : 'Gerar lançamentos'}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Resumo rotulo="Saldo somado das contas" valor={saldo} />
        <Resumo rotulo="Fixas do mês" valor={totalFixas} nota={`${fixas.filter((f) => f.ativa).length} contas`} />
        <Resumo
          rotulo="Variáveis (média)"
          valor={totalVariaveis}
          nota={`${variaveis.length} contas acompanhadas`}
        />
        <Resumo
          rotulo="Ainda a pagar"
          valor={totalAPagar}
          nota={`${aPagar.length} em aberto`}
          tom={aPagar.length ? 'critico' : 'neutro'}
        />
      </div>

      <Tabs defaultValue="vencimentos">
        <TabsList>
          <TabsTrigger value="vencimentos">Vencimentos</TabsTrigger>
          <TabsTrigger value="fixas">Fixas</TabsTrigger>
          <TabsTrigger value="variaveis">Variáveis</TabsTrigger>
          <TabsTrigger value="bancarias">Contas bancárias</TabsTrigger>
        </TabsList>

        {/* Vencimentos do mês */}
        <TabsContent value="vencimentos">
          <Card>
            <CardHeader>
              <CardTitle>O que vence neste mês</CardTitle>
              <CardDescription>
                Marque como pago assim que quitar — o saldo das contas acompanha na hora.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lembretes.length ? (
                <ul className="space-y-2">
                  {lembretes.map(({ recorrencia, lancamento, data, pago, distancia }) => {
                    const valor = lancamento?.valor ?? recorrencia.valorPrevisto;
                    const atrasado = !pago && distancia.dias < 0;
                    const proximo = !pago && distancia.dias >= 0 && distancia.dias <= recorrencia.lembreteDias;

                    return (
                      <li
                        key={recorrencia.id}
                        className="flex flex-wrap items-center gap-3 rounded-control border border-line p-3"
                      >
                        <button
                          onClick={() => marcarPagamento(recorrencia, lancamento, data)}
                          disabled={executando}
                          aria-label={`Marcar ${recorrencia.nome} como ${pago ? 'pendente' : 'pago'}`}
                          className={`grid size-7 shrink-0 place-items-center rounded-full border transition-colors ${
                            pago
                              ? 'border-cedula bg-cedula text-cedula-fg'
                              : 'border-line-strong text-transparent hover:border-cedula hover:text-cedula/40'
                          } disabled:opacity-40`}
                        >
                          <Check className="size-4" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-[13.5px] font-medium ${pago ? 'text-ink-muted line-through' : ''}`}
                          >
                            {recorrencia.nome}
                          </p>
                          <p className="text-[11.5px] text-ink-faint">
                            vence {dataCurta(data)} · {distancia.texto}
                            {recorrencia.natureza === 'variavel' ? ' · valor estimado' : ''}
                          </p>
                        </div>

                        {atrasado && <Badge tom="critico">atrasado</Badge>}
                        {proximo && <Badge tom="aviso"><CalendarClock />em breve</Badge>}

                        <Valor valor={valor} className="w-24 shrink-0 text-right text-[14px] font-semibold" />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EstadoVazio
                  icone={CalendarClock}
                  titulo="Nenhum vencimento neste mês"
                  descricao="Cadastre suas contas fixas e variáveis para elas aparecerem aqui todo mês, sem você precisar lembrar."
                  acao={
                    <Button onClick={() => novaRecorrencia('fixa')}>
                      <Plus />
                      Cadastrar conta
                    </Button>
                  }
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fixas */}
        <TabsContent value="fixas">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Contas fixas</CardTitle>
                <CardDescription>
                  Mesmo valor todo mês. O lançamento é gerado automaticamente na data de vencimento.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => novaRecorrencia('fixa')}>
                <Plus />
                Nova
              </Button>
            </CardHeader>
            <CardContent>
              {fixas.length ? (
                <ul className="space-y-2">
                  {fixas.map((rec) => (
                    <LinhaRecorrencia
                      key={rec.id}
                      recorrencia={rec}
                      categoria={categorias.find((c) => c.id === rec.categoriaId)?.nome}
                      onEditar={() => {
                        setRecEditando(rec);
                        setNatureza(rec.natureza);
                        setRecDialog(true);
                      }}
                      onExcluir={() => setExcluirRec(rec)}
                      onAlternar={() =>
                        executar(() => updateRecorrencia(rec.id, { ativa: !rec.ativa }), {
                          sucesso: rec.ativa ? `${rec.nome} pausada` : `${rec.nome} reativada`,
                        })
                      }
                    />
                  ))}
                </ul>
              ) : (
                <EstadoVazio
                  icone={Repeat}
                  titulo="Nenhuma conta fixa"
                  descricao="Aluguel, internet, plano de saúde, mensalidade. Cadastre uma vez e o lançamento aparece todo mês."
                  acao={
                    <Button onClick={() => novaRecorrencia('fixa')}>
                      <Plus />
                      Cadastrar conta fixa
                    </Button>
                  }
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Variáveis */}
        <TabsContent value="variaveis">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Contas variáveis</CardTitle>
                <CardDescription>
                  Valor muda todo mês. O sistema guarda o histórico, calcula a média e avisa quando a
                  cobrança sai da curva.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => novaRecorrencia('variavel')}>
                <Plus />
                Nova
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {variaveis.length ? (
                mediasVariaveis.map(({ rec, analise }) => {
                  const historico = transacoes
                    .filter((t) => t.recorrenciaId === rec.id)
                    .sort((a, b) => a.data.localeCompare(b.data))
                    .slice(-6)
                    .map((t) => ({
                      mes: MESES_CURTOS[dataDe(t.data).getMonth()],
                      valor: t.valor,
                      acima: t.valor > analise.media,
                    }));

                  const alerta = analise.desvio !== null && analise.desvio > 25;

                  return (
                    <div key={rec.id} className="rounded-control border border-line p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-[14px] font-medium">{rec.nome}</p>
                            {!rec.ativa && <Badge tom="neutro">pausada</Badge>}
                            {alerta && (
                              <Badge tom="critico">
                                <TriangleAlert />
                                {percentual(analise.desvio, 0)} acima da média
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-ink-faint">
                            vence dia {rec.diaVencimento} ·{' '}
                            {analise.amostras > 0
                              ? `média de ${moeda(analise.media)} em ${analise.amostras} ${analise.amostras === 1 ? 'mês' : 'meses'}`
                              : 'sem histórico ainda'}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[11px] text-ink-muted">Última cobrança</p>
                          <Valor
                            valor={analise.ultimo ?? rec.valorPrevisto}
                            className={`font-display text-[18px] font-semibold ${alerta ? 'text-coral' : ''}`}
                          />
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="fantasma" size="icone-sm" aria-label={`Ações de ${rec.nome}`}>
                              <MoreVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setRecEditando(rec);
                                setNatureza(rec.natureza);
                                setRecDialog(true);
                              }}
                            >
                              <Pencil />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem destrutivo onSelect={() => setExcluirRec(rec)}>
                              <Trash2 />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {historico.length > 1 && (
                        <div className="mt-4">
                          <ResponsiveContainer width="100%" height={110}>
                            <BarChart data={historico} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                              <CartesianGrid vertical={false} stroke="hsl(var(--line))" strokeDasharray="3 3" />
                              <XAxis
                                dataKey="mes"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fill: 'hsl(var(--ink-faint))' }}
                              />
                              <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={52}
                                tick={{ fontSize: 10, fill: 'hsl(var(--ink-faint))' }}
                                tickFormatter={(v) =>
                                  perfil.ocultarValores ? '•••' : moeda(v, { compacto: true })
                                }
                              />
                              <Tooltip content={<DicaGrafico oculto={perfil.ocultarValores} />} cursor={false} />
                              <ReferenceLine
                                y={analise.media}
                                stroke="hsl(var(--aco))"
                                strokeDasharray="4 4"
                                label={{
                                  value: 'média',
                                  fontSize: 10,
                                  fill: 'hsl(var(--aco))',
                                  position: 'insideTopRight',
                                }}
                              />
                              <Bar dataKey="valor" name="Cobrança" radius={[4, 4, 0, 0]} maxBarSize={34}>
                                {historico.map((h, i) => (
                                  <Cell
                                    key={i}
                                    fill={h.acima ? 'hsl(var(--coral))' : 'hsl(var(--cedula))'}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <EstadoVazio
                  icone={TriangleAlert}
                  titulo="Nenhuma conta variável"
                  descricao="Luz, água, gás, combustível. Cadastre e, a partir do terceiro mês, você recebe um aviso sempre que a cobrança vier acima da média."
                  acao={
                    <Button onClick={() => novaRecorrencia('variavel')}>
                      <Plus />
                      Cadastrar conta variável
                    </Button>
                  }
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contas bancárias */}
        <TabsContent value="bancarias">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Contas bancárias</CardTitle>
                <CardDescription>Saldo calculado a partir do saldo inicial e dos lançamentos pagos.</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setContaEditando(null);
                  setContaDialog(true);
                }}
              >
                <Plus />
                Nova
              </Button>
            </CardHeader>
            <CardContent>
              {contas.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {contas.map((conta) => (
                    <CartaoConta
                      key={conta.id}
                      conta={conta}
                      saldo={saldoDaConta(conta, transacoes)}
                      onEditar={() => {
                        setContaEditando(conta);
                        setContaDialog(true);
                      }}
                      onExcluir={() => setExcluirConta(conta)}
                    />
                  ))}
                </div>
              ) : (
                <EstadoVazio
                  icone={Banknote}
                  titulo="Nenhuma conta cadastrada"
                  descricao="Cadastre onde seu dinheiro fica: conta corrente, poupança, carteira digital ou dinheiro em espécie."
                  acao={
                    <Button
                      onClick={() => {
                        setContaEditando(null);
                        setContaDialog(true);
                      }}
                    >
                      <Plus />
                      Criar conta
                    </Button>
                  }
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DialogConta aberto={contaDialog} onAbertoChange={setContaDialog} conta={contaEditando} />
      <DialogRecorrencia
        aberto={recDialog}
        onAbertoChange={setRecDialog}
        recorrencia={recEditando}
        naturezaInicial={natureza}
      />

      <Confirmar
        aberto={Boolean(excluirConta)}
        onAbertoChange={(v) => !v && setExcluirConta(null)}
        titulo={`Excluir ${excluirConta?.nome ?? 'a conta'}?`}
        descricao="Os lançamentos feitos nela continuam no histórico, mas ficam sem conta vinculada."
        rotuloConfirmar="Excluir conta"
        onConfirmar={() => {
          if (excluirConta) {
            executar(() => removeConta(excluirConta.id), {
              sucesso: 'Conta excluída',
              aoFalhar: 'Não foi possível excluir a conta',
            });
          }
        }}
      />
      <Confirmar
        aberto={Boolean(excluirRec)}
        onAbertoChange={(v) => !v && setExcluirRec(null)}
        titulo={`Excluir ${excluirRec?.nome ?? 'a recorrência'}?`}
        descricao="Os lançamentos já gerados continuam no histórico. Só a geração automática para."
        rotuloConfirmar="Excluir"
        onConfirmar={() => {
          if (excluirRec) {
            executar(() => removeRecorrencia(excluirRec.id), {
              sucesso: 'Conta recorrente excluída',
              aoFalhar: 'Não foi possível excluir',
            });
          }
        }}
      />
    </div>
  );
}

function LinhaRecorrencia({
  recorrencia,
  categoria,
  onEditar,
  onExcluir,
  onAlternar,
}: {
  recorrencia: Recorrencia;
  categoria?: string;
  onEditar: () => void;
  onExcluir: () => void;
  onAlternar: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-control border border-line p-3">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-control ${
          recorrencia.tipo === 'receita' ? 'bg-cedula-soft text-cedula-ink' : 'bg-aco-soft text-aco'
        }`}
      >
        <Receipt className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13.5px] font-medium">{recorrencia.nome}</p>
          {!recorrencia.ativa && <Badge tom="neutro">pausada</Badge>}
        </div>
        <p className="truncate text-[11.5px] text-ink-faint">
          dia {recorrencia.diaVencimento}
          {categoria ? ` · ${categoria}` : ''}
          {recorrencia.periodicidade !== 'mensal' ? ` · ${recorrencia.periodicidade}` : ''}
        </p>
      </div>
      <Valor valor={recorrencia.valorPrevisto} className="shrink-0 text-[14px] font-semibold" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="fantasma" size="icone-sm" aria-label={`Ações de ${recorrencia.nome}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEditar}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAlternar}>
            <Repeat />
            {recorrencia.ativa ? 'Pausar' : 'Reativar'}
          </DropdownMenuItem>
          <DropdownMenuItem destrutivo onSelect={onExcluir}>
            <Trash2 />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function Resumo({
  rotulo,
  valor,
  nota,
  tom = 'neutro',
}: {
  rotulo: string;
  valor: number;
  nota?: string;
  tom?: 'neutro' | 'critico';
}) {
  return (
    <div className="painel p-4">
      <p className="text-[12px] text-ink-muted">{rotulo}</p>
      <Valor
        valor={valor}
        className={`mt-1 block font-display text-[20px] font-semibold ${tom === 'critico' ? 'text-coral' : ''}`}
      />
      {nota ? <p className="mt-0.5 text-[11.5px] text-ink-faint">{nota}</p> : null}
    </div>
  );
}
