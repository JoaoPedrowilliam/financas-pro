'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Calculator, CheckCircle2, MoreVertical, Pencil, Plus, Scale, ShieldCheck, Trash2, Wallet,
} from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { Confirmar } from '@/components/shared/confirmar';
import { Valor } from '@/components/shared/valor';
import { CampoValor } from '@/components/shared/campo-valor';
import { DialogDivida } from '@/components/dividas/dialog-divida';
import { SimuladorQuitacao } from '@/components/dividas/simulador-quitacao';
import { DicaGrafico } from '@/components/dashboard/dica-grafico';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useFinancas } from '@/store/use-financas';
import { useAcao } from '@/lib/acoes';
import { custoSeManter, planoDeQuitacao, type Estrategia } from '@/lib/financas';
import { moeda } from '@/lib/format';
import { hojeISO, somar } from '@/lib/utils';
import type { Divida } from '@/types';

export default function PaginaDividas() {
  const { dividas, removeDivida, registrarPagamento, perfil } = useFinancas();
  const { executar } = useAcao();

  const [estrategia, setEstrategia] = React.useState<Estrategia>('avalanche');
  const [orcamento, setOrcamento] = React.useState(0);
  const [emEdicao, setEmEdicao] = React.useState<Divida | null>(null);
  const [dialogAberto, setDialogAberto] = React.useState(false);
  const [simulando, setSimulando] = React.useState<Divida | null>(null);
  const [pagando, setPagando] = React.useState<Divida | null>(null);
  const [excluindo, setExcluindo] = React.useState<Divida | null>(null);

  const abertas = dividas.filter((d) => d.status !== 'quitada');
  const quitadas = dividas.filter((d) => d.status === 'quitada');
  const negativadas = abertas.filter((d) => d.negativado);

  const totalDevido = somar(abertas, (d) => d.valorAcordo ?? d.saldoAtual);
  const totalSemAcordo = somar(abertas, (d) => d.saldoAtual);
  const descontoAcordos = totalSemAcordo - totalDevido;
  const custoRolando = somar(abertas, custoSeManter);
  const jurosMedio = abertas.length
    ? somar(abertas, (d) => d.jurosMes * d.saldoAtual) / totalSemAcordo
    : 0;

  // Sugestão inicial: 15% a mais que a soma dos mínimos, para haver sobra a aplicar.
  const minimoSugerido = React.useMemo(
    () => Math.ceil(somar(abertas, (d) => d.valorParcela ?? Math.max(d.saldoAtual * 0.03, 50)) * 1.15),
    [abertas],
  );

  React.useEffect(() => {
    if (orcamento === 0 && minimoSugerido > 0) setOrcamento(minimoSugerido);
  }, [minimoSugerido, orcamento]);

  const plano = React.useMemo(
    () => (abertas.length && orcamento > 0 ? planoDeQuitacao(abertas, orcamento, estrategia) : null),
    [abertas, orcamento, estrategia],
  );

  const progressoGeral =
    dividas.length > 0
      ? (somar(dividas, (d) => d.valorOriginal - (d.status === 'quitada' ? 0 : d.saldoAtual)) /
          Math.max(1, somar(dividas, (d) => d.valorOriginal))) *
        100
      : 0;

  const novaDivida = () => {
    setEmEdicao(null);
    setDialogAberto(true);
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Plano para limpar meu nome"
        descricao="Cadastre o que está em aberto, veja quanto os juros ainda vão custar e monte uma ordem de pagamento que cabe no seu mês."
        acoes={
          <Button onClick={novaDivida}>
            <Plus />
            Cadastrar dívida
          </Button>
        }
      />

      {dividas.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={Scale}
            titulo="Nenhuma dívida cadastrada"
            descricao="Comece pelo que está negativado. Você vai precisar do nome do credor, do saldo devedor de hoje e da taxa de juros ao mês — tudo isso costuma estar no boleto ou no app do banco."
            acao={
              <Button onClick={novaDivida}>
                <Plus />
                Cadastrar a primeira
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Painel-herói: a situação do nome vem antes dos números. */}
          <section className="painel overflow-hidden p-6 shadow-raised sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`grid size-9 place-items-center rounded-control ${
                      negativadas.length ? 'bg-coral-soft text-coral' : 'bg-cedula-soft text-cedula-ink'
                    }`}
                  >
                    {negativadas.length ? <Scale className="size-[18px]" /> : <ShieldCheck className="size-[18px]" />}
                  </span>
                  <p className="text-[13px] font-medium text-ink-muted">
                    {negativadas.length
                      ? `${negativadas.length} ${negativadas.length === 1 ? 'pendência negativa' : 'pendências negativas'}`
                      : 'Nenhuma pendência negativa'}
                  </p>
                </div>

                <p className="mt-3 font-display text-cifra font-semibold tracking-tight">
                  <Valor valor={totalDevido} />
                </p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  {negativadas.length
                    ? `É o que falta para tirar seu nome de ${Array.from(new Set(negativadas.map((d) => d.orgao).filter((o) => o && o !== 'Nenhum'))).join(', ') || 'todos os órgãos'}.`
                    : 'Saldo total em aberto, contando os acordos negociados.'}
                </p>

                {descontoAcordos > 0 && (
                  <p className="mt-2 text-[12.5px] text-cedula-ink">
                    Os acordos que você já negociou tiram {moeda(descontoAcordos)} do saldo cheio de{' '}
                    {moeda(totalSemAcordo)}.
                  </p>
                )}

                <div className="mt-5">
                  <div className="flex items-baseline justify-between text-[12px] text-ink-muted">
                    <span>Já amortizado</span>
                    <span className="cifra">{progressoGeral.toFixed(0)}%</span>
                  </div>
                  <Progress valor={progressoGeral} className="mt-1.5 h-2.5" rotulo="Progresso da quitação" />
                </div>
              </div>

              <div className="grid shrink-0 gap-3 sm:grid-cols-3 lg:w-[420px]">
                <Metrica rotulo="Juros médio ao mês" texto={`${jurosMedio.toFixed(1)}%`} tom="critico" />
                <Metrica rotulo="Custo se nada mudar" valor={custoRolando} tom="critico" />
                <Metrica rotulo="Dívidas quitadas" texto={String(quitadas.length)} tom="positivo" />
              </div>
            </div>
          </section>

          {/* Plano de ataque */}
          <Card>
            <CardHeader>
              <CardTitle>Ordem de pagamento</CardTitle>
              <CardDescription>
                Você paga o mínimo de todas e joga a sobra na dívida da vez. A estratégia muda qual é a
                dívida da vez.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="sm:w-52">
                  <Label htmlFor="orcamento">Quanto sobra por mês</Label>
                  <div className="mt-1.5">
                    <CampoValor id="orcamento" value={orcamento} onChange={setOrcamento} />
                  </div>
                </div>

                <div className="min-w-0">
                  <Label>Estratégia</Label>
                  <Tabs
                    value={estrategia}
                    onValueChange={(v) => setEstrategia(v as Estrategia)}
                    className="mt-1.5"
                  >
                    <TabsList>
                      <TabsTrigger value="avalanche">Maior juros primeiro</TabsTrigger>
                      <TabsTrigger value="bola-de-neve">Menor saldo primeiro</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {estrategia === 'avalanche'
                  ? 'Atacar a dívida com juros mais altos é o caminho matematicamente mais barato: você paga menos juros no total.'
                  : 'Atacar a menor dívida primeiro custa um pouco mais em juros, mas entrega vitórias rápidas — o que ajuda muita gente a não desistir no meio.'}
              </p>

              {plano && !plano.viavel && (
                <div className="rounded-control border border-ambar/40 bg-ambar-soft p-4">
                  <p className="text-[13px] font-medium text-ambar">
                    Esse valor não cobre nem os pagamentos mínimos
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                    Os mínimos somam {moeda(plano.minimoNecessario)} por mês. Abaixo disso, as dívidas
                    crescem em vez de diminuir. Vale tentar renegociar prazos antes de montar o plano.
                  </p>
                </div>
              )}

              {plano && plano.viavel && (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metrica
                      rotulo="Livre em"
                      texto={
                        plano.meses >= 12
                          ? `${Math.floor(plano.meses / 12)}a ${plano.meses % 12}m`
                          : `${plano.meses} meses`
                      }
                      tom="positivo"
                    />
                    <Metrica rotulo="Total pago" valor={plano.totalPago} />
                    <Metrica rotulo="Juros no caminho" valor={plano.jurosPagos} tom="critico" />
                  </div>

                  <div className="rounded-control border border-line p-4">
                    <p className="mb-3 text-[13px] font-medium">Saldo total até a quitação</p>
                    <ResponsiveContainer width="100%" height={190}>
                      <LineChart
                        data={[{ mes: 0, saldoTotal: totalDevido }, ...plano.linhaDoTempo]}
                        margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
                      >
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
                          tickFormatter={(v) => (perfil.ocultarValores ? '•••' : moeda(v, { compacto: true }))}
                        />
                        <Tooltip
                          content={<DicaGrafico oculto={perfil.ocultarValores} />}
                          labelFormatter={(v) => `Mês ${v}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="saldoTotal"
                          name="Saldo devedor"
                          stroke="hsl(var(--cedula))"
                          strokeWidth={2.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {plano.quitacoes.length > 0 && (
                    <ol className="space-y-2">
                      {plano.quitacoes.map((q, i) => (
                        <li
                          key={q.credor}
                          className="flex items-center gap-3 rounded-control border border-line p-3"
                        >
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cedula-soft text-[11px] font-semibold text-cedula-ink">
                            {i + 1}
                          </span>
                          <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{q.credor}</p>
                          <Badge tom="positivo">
                            quita no mês {q.mes}
                          </Badge>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Lista de dívidas */}
          <div className="grid gap-4 md:grid-cols-2">
            {[...abertas, ...quitadas].map((divida) => {
              const base = divida.valorAcordo ?? divida.saldoAtual;
              const pago = Math.max(0, divida.valorOriginal - divida.saldoAtual);
              const pct = divida.valorOriginal > 0 ? (pago / divida.valorOriginal) * 100 : 0;
              const quitada = divida.status === 'quitada';

              return (
                <Card key={divida.id} className={quitada ? 'opacity-70' : undefined}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-display text-[15px] font-semibold">{divida.credor}</p>
                          {quitada && (
                            <Badge tom="positivo">
                              <CheckCircle2 />
                              quitada
                            </Badge>
                          )}
                          {divida.status === 'negociando' && <Badge tom="info">em negociação</Badge>}
                          {divida.negativado && divida.orgao && divida.orgao !== 'Nenhum' && (
                            <Badge tom="critico">{divida.orgao}</Badge>
                          )}
                        </div>
                        {divida.descricao && (
                          <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">{divida.descricao}</p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="fantasma" size="icone-sm" aria-label={`Ações de ${divida.credor}`}>
                            <MoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEmEdicao(divida);
                              setDialogAberto(true);
                            }}
                          >
                            <Pencil />
                            Editar
                          </DropdownMenuItem>
                          {!quitada && (
                            <>
                              <DropdownMenuItem onSelect={() => setSimulando(divida)}>
                                <Calculator />
                                Simular quitação
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setPagando(divida)}>
                                <Wallet />
                                Registrar pagamento
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem destrutivo onSelect={() => setExcluindo(divida)}>
                            <Trash2 />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11.5px] text-ink-muted">
                          {divida.valorAcordo ? 'Valor do acordo' : 'Saldo devedor'}
                        </p>
                        <Valor
                          valor={base}
                          className="font-display text-[22px] font-semibold"
                        />
                        {divida.valorAcordo && (
                          <p className="text-[11.5px] text-cedula-ink">
                            de {moeda(divida.saldoAtual)} sem o acordo
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[11.5px] text-ink-muted">Juros</p>
                        <p className="cifra font-display text-[17px] font-semibold text-coral">
                          {divida.jurosMes.toFixed(1)}%
                        </p>
                        <p className="text-[11px] text-ink-faint">ao mês</p>
                      </div>
                    </div>

                    <Progress
                      valor={pct}
                      cor={quitada ? 'hsl(var(--cedula))' : undefined}
                      className="mt-4"
                      rotulo={`Progresso de ${divida.credor}`}
                    />
                    <div className="mt-2 flex justify-between text-[11.5px] text-ink-muted">
                      <span>
                        <Valor valor={pago} className="font-medium text-ink" /> pagos
                      </span>
                      <span>de {moeda(divida.valorOriginal)}</span>
                    </div>

                    {divida.parcelasRestantes && divida.valorParcela ? (
                      <p className="mt-3 text-[12px] text-ink-muted">
                        {divida.parcelasRestantes} parcelas de {moeda(divida.valorParcela)} restantes.
                      </p>
                    ) : null}

                    {!quitada && (
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="contorno"
                          size="sm"
                          className="flex-1"
                          onClick={() => setSimulando(divida)}
                        >
                          <Calculator />
                          Simular
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => setPagando(divida)}>
                          <Wallet />
                          Registrar pagamento
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <DialogDivida aberto={dialogAberto} onAbertoChange={setDialogAberto} divida={emEdicao} />
      <SimuladorQuitacao
        aberto={Boolean(simulando)}
        onAbertoChange={(v) => !v && setSimulando(null)}
        divida={simulando}
      />
      <DialogPagamento
        divida={pagando}
        onFechar={() => setPagando(null)}
        onRegistrar={async (valor, data, obs) => {
          if (!pagando) return;
          const quitou = valor >= (pagando.valorAcordo ?? pagando.saldoAtual);
          const ok = await executar(
            () => registrarPagamento(pagando.id, { valor, data, observacao: obs }),
            {
              sucesso: quitou ? `${pagando.credor} quitada` : 'Pagamento registrado',
              descricao: quitou
                ? 'Uma pendência a menos no seu nome.'
                : `${moeda(valor)} abatidos do saldo devedor.`,
              aoFalhar: 'O pagamento não foi registrado',
            },
          );
          if (ok) setPagando(null);
        }}
      />
      <Confirmar
        aberto={Boolean(excluindo)}
        onAbertoChange={(v) => !v && setExcluindo(null)}
        titulo={`Excluir a dívida de ${excluindo?.credor ?? ''}?`}
        descricao="O histórico de pagamentos registrado nela também será apagado. Isso não pode ser desfeito."
        rotuloConfirmar="Excluir dívida"
        onConfirmar={() => {
          if (excluindo) {
            executar(() => removeDivida(excluindo.id), {
              sucesso: 'Dívida excluída',
              aoFalhar: 'Não foi possível excluir a dívida',
            });
          }
        }}
      />
    </div>
  );
}

function Metrica({
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
  const cor = tom === 'positivo' ? 'text-cedula-ink' : tom === 'critico' ? 'text-coral' : 'text-ink';
  return (
    <div className="rounded-control border border-line p-3">
      <p className="text-[11.5px] leading-tight text-ink-muted">{rotulo}</p>
      {texto ? (
        <p className={`cifra mt-1 font-display text-[18px] font-semibold ${cor}`}>{texto}</p>
      ) : (
        <Valor valor={valor ?? 0} compacto className={`mt-1 block font-display text-[18px] font-semibold ${cor}`} />
      )}
    </div>
  );
}

function DialogPagamento({
  divida,
  onFechar,
  onRegistrar,
}: {
  divida: Divida | null;
  onFechar: () => void;
  onRegistrar: (valor: number, data: string, observacao?: string) => void;
}) {
  const [valor, setValor] = React.useState(0);
  const [data, setData] = React.useState(hojeISO());
  const [obs, setObs] = React.useState('');

  React.useEffect(() => {
    if (!divida) return;
    setValor(divida.valorParcela ?? 0);
    setData(hojeISO());
    setObs('');
  }, [divida]);

  if (!divida) return null;
  const restante = divida.valorAcordo ?? divida.saldoAtual;

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent largura="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {divida.credor} — restam {moeda(restante)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="pg-valor">Valor pago</Label>
            <div className="mt-1.5">
              <CampoValor id="pg-valor" value={valor} onChange={setValor} />
            </div>
            {valor > 0 && valor < restante && (
              <p className="mt-1 text-[12px] text-ink-muted">
                Sobram {moeda(restante - valor)} depois deste pagamento.
              </p>
            )}
            {valor >= restante && restante > 0 && (
              <p className="mt-1 text-[12px] text-cedula-ink">Este pagamento quita a dívida.</p>
            )}
          </div>

          <div>
            <Label htmlFor="pg-data">Data</Label>
            <Input
              id="pg-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="pg-obs">Observação</Label>
            <Input
              id="pg-obs"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Número do acordo, comprovante…"
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="contorno" onClick={onFechar}>
            Cancelar
          </Button>
          <Button disabled={valor <= 0} onClick={() => onRegistrar(valor, data, obs || undefined)}>
            Registrar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
