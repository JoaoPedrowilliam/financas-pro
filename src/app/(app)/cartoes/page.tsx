'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  CalendarClock, CreditCard, MoreVertical, Pencil, Plus, Repeat, Trash2, Wallet,
} from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { SeletorCompetencia } from '@/components/shared/seletor-competencia';
import { Confirmar } from '@/components/shared/confirmar';
import { Valor } from '@/components/shared/valor';
import { DialogAssinatura, DialogCartao } from '@/components/cartoes/dialogs';
import { CartaoVisual } from '@/components/cartoes/cartao-visual';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFinancas } from '@/store/use-financas';
import { faturaDoCartao, limiteUsado } from '@/lib/financas';
import { dataCurta, distanciaEmDias, moeda } from '@/lib/format';
import { competenciaDe, competencia, mesSeguinte, somar } from '@/lib/utils';
import type { Assinatura, Cartao } from '@/types';

export default function PaginaCartoes() {
  const estado = useFinancas();
  const { cartoes, transacoes, assinaturas, categorias, removeCartao, removeAssinatura, updateAssinatura } = estado;

  const hoje = new Date();
  const [comp, setComp] = React.useState(() => competenciaDe(hoje.getFullYear(), hoje.getMonth() + 1));
  const [cartaoDialog, setCartaoDialog] = React.useState(false);
  const [assinaturaDialog, setAssinaturaDialog] = React.useState(false);
  const [cartaoEditando, setCartaoEditando] = React.useState<Cartao | null>(null);
  const [assinaturaEditando, setAssinaturaEditando] = React.useState<Assinatura | null>(null);
  const [excluirCartao, setExcluirCartao] = React.useState<Cartao | null>(null);
  const [excluirAssinatura, setExcluirAssinatura] = React.useState<Assinatura | null>(null);

  const ativos = cartoes.filter((c) => !c.arquivado);
  const deCredito = ativos.filter((c) => c.tipo !== 'debito');

  const faturas = React.useMemo(
    () => deCredito.map((c) => ({ cartao: c, fatura: faturaDoCartao(c, transacoes, comp) })),
    [deCredito, transacoes, comp],
  );

  const totalFaturas = somar(faturas, (f) => f.fatura.total);
  const limiteTotal = somar(deCredito, (c) => c.limite);
  const usadoTotal = somar(deCredito, (c) => limiteUsado(c, transacoes));

  // Parcelas que ainda vão cair em meses futuros — o "custo já contratado".
  const comprometidoFuturo = React.useMemo(() => {
    const compAtual = competenciaDe(hoje.getFullYear(), hoje.getMonth() + 1);
    const futuras = transacoes.filter(
      (t) => t.cartaoId && t.status !== 'pago' && competencia(t.data) > compAtual,
    );
    const porMes = new Map<string, number>();
    for (const t of futuras) {
      const c = competencia(t.data);
      porMes.set(c, (porMes.get(c) ?? 0) + t.valor);
    }
    return {
      total: somar(futuras, (t) => t.valor),
      meses: Array.from(porMes.entries()).sort().slice(0, 6),
      quantidade: futuras.length,
    };
  }, [transacoes, hoje]);

  const totalAssinaturas = somar(assinaturas.filter((a) => a.ativa), (a) => a.valor);

  const nomeCategoria = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nome ?? 'Sem categoria';
  const nomeCartao = (id: string | null) => cartoes.find((c) => c.id === id)?.nome ?? '—';

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Cartões"
        descricao="Faturas, limite comprometido, compras parceladas e cobranças recorrentes."
        acoes={
          <>
            <SeletorCompetencia valor={comp} onChange={setComp} />
            <Button
              onClick={() => {
                setCartaoEditando(null);
                setCartaoDialog(true);
              }}
            >
              <Plus />
              Novo cartão
            </Button>
          </>
        }
      />

      {ativos.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={CreditCard}
            titulo="Nenhum cartão cadastrado"
            descricao="Cadastre seus cartões para acompanhar faturas, ver quanto do limite já está comprometido e deixar as assinaturas entrarem sozinhas todo mês."
            acao={
              <Button
                onClick={() => {
                  setCartaoEditando(null);
                  setCartaoDialog(true);
                }}
              >
                <Plus />
                Cadastrar cartão
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo rotulo="Faturas do mês" valor={totalFaturas} />
            <Resumo
              rotulo="Limite comprometido"
              valor={usadoTotal}
              nota={limiteTotal > 0 ? `${((usadoTotal / limiteTotal) * 100).toFixed(0)}% de ${moeda(limiteTotal)}` : undefined}
              tom={usadoTotal / Math.max(1, limiteTotal) > 0.7 ? 'critico' : 'neutro'}
            />
            <Resumo
              rotulo="Parcelas futuras"
              valor={comprometidoFuturo.total}
              nota={`${comprometidoFuturo.quantidade} lançamentos a cair`}
            />
            <Resumo
              rotulo="Assinaturas por mês"
              valor={totalAssinaturas}
              nota={`${moeda(totalAssinaturas * 12)} no ano`}
            />
          </div>

          <Tabs defaultValue="faturas">
            <TabsList>
              <TabsTrigger value="faturas">Faturas</TabsTrigger>
              <TabsTrigger value="futuras">Compras futuras</TabsTrigger>
              <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
            </TabsList>

            <TabsContent value="faturas">
              <div className="grid gap-4 lg:grid-cols-2">
                {faturas.map(({ cartao, fatura }) => {
                  const usado = limiteUsado(cartao, transacoes);
                  const venc = distanciaEmDias(fatura.vencimento);
                  const seguinte = faturaDoCartao(cartao, transacoes, mesSeguinte(comp));

                  return (
                    <Card key={cartao.id}>
                      <CardContent className="p-5">
                        <CartaoVisual
                          cartao={cartao}
                          usado={usado}
                          acoes={
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-control text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                                  aria-label={`Ações de ${cartao.nome}`}
                                >
                                  <MoreVertical className="size-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setCartaoEditando(cartao);
                                    setCartaoDialog(true);
                                  }}
                                >
                                  <Pencil />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem destrutivo onSelect={() => setExcluirCartao(cartao)}>
                                  <Trash2 />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          }
                        />

                        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
                          <div>
                            <p className="text-[11.5px] text-ink-muted">
                              Fatura {fatura.fechada ? 'fechada' : 'em aberto'}
                            </p>
                            <Valor valor={fatura.total} className="font-display text-[26px] font-semibold" />
                          </div>
                          <Badge tom={venc.dias < 0 ? 'critico' : venc.dias <= 5 ? 'aviso' : 'neutro'}>
                            <CalendarClock />
                            vence {venc.texto}
                          </Badge>
                        </div>

                        {fatura.itens.length > 0 ? (
                          <ul className="mt-4 max-h-56 space-y-1 overflow-y-auto scroll-fino pr-1">
                            {fatura.itens.map((t) => (
                              <li key={t.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                                <span className="w-10 shrink-0 text-[11.5px] text-ink-faint">
                                  {dataCurta(t.data)}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{t.descricao}</span>
                                <span className="shrink-0 text-[11px] text-ink-faint">
                                  {nomeCategoria(t.categoriaId)}
                                </span>
                                <Valor valor={t.valor} className="w-24 shrink-0 text-right font-medium" />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-4 rounded-control border border-line px-3 py-6 text-center text-[13px] text-ink-muted">
                            Nenhuma compra nesta fatura.
                            {/* Compra feita depois do fechamento cai na fatura seguinte — é o que o
                                cartão faz de verdade. Sem esta linha, "fatura R$ 0,00" ao lado de um
                                limite comprometido parece erro de conta. */}
                            {seguinte.total > 0 && (
                              <span className="mt-1 block text-[12.5px] text-ink-faint">
                                As compras feitas depois do dia {cartao.diaFechamento} entraram na
                                próxima fatura, que soma <Valor valor={seguinte.total} /> e fecha em{' '}
                                {dataCurta(seguinte.fechamento)}.
                              </span>
                            )}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="futuras">
              <Card>
                <CardHeader>
                  <CardTitle>O que já está comprometido</CardTitle>
                  <CardDescription>
                    Parcelas e cobranças que ainda vão cair nos próximos meses. Esse dinheiro já tem dono.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {comprometidoFuturo.meses.length ? (
                    <ul className="space-y-2">
                      {comprometidoFuturo.meses.map(([mes, valor]) => {
                        const maior = Math.max(...comprometidoFuturo.meses.map(([, v]) => v));
                        return (
                          <li key={mes} className="rounded-control border border-line p-3">
                            <div className="flex items-baseline justify-between">
                              <span className="text-[13px] font-medium">
                                {new Date(Number(mes.split('-')[0]), Number(mes.split('-')[1]) - 1)
                                  .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                              </span>
                              <Valor valor={valor} className="text-[14px] font-semibold" />
                            </div>
                            <Progress
                              valor={(valor / maior) * 100}
                              className="mt-2 h-1.5"
                              cor="hsl(var(--violeta))"
                              rotulo={`Comprometido em ${mes}`}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <EstadoVazio
                      icone={Wallet}
                      titulo="Nada parcelado à frente"
                      descricao="Quando você registrar uma compra parcelada no cartão, cada parcela aparece aqui no mês em que vai cair."
                      className="py-10"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assinaturas">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Cobranças recorrentes</CardTitle>
                    <CardDescription>
                      Entram sozinhas na fatura todo mês, como lançamento pendente.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setAssinaturaEditando(null);
                      setAssinaturaDialog(true);
                    }}
                  >
                    <Plus />
                    Nova
                  </Button>
                </CardHeader>
                <CardContent>
                  {assinaturas.length ? (
                    <ul className="space-y-2">
                      {assinaturas.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center gap-3 rounded-control border border-line p-3"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-control bg-violeta-soft text-violeta">
                            <Repeat className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">{a.nome}</p>
                            <p className="text-[11.5px] text-ink-faint">
                              dia {a.diaCobranca} · {nomeCartao(a.cartaoId)}
                            </p>
                          </div>
                          <Valor valor={a.valor} className="shrink-0 text-[14px] font-semibold" />
                          <Switch
                            checked={a.ativa}
                            onCheckedChange={(v) => {
                              updateAssinatura(a.id, { ativa: v });
                              toast.success(v ? `${a.nome} reativada` : `${a.nome} pausada`);
                            }}
                            aria-label={`${a.ativa ? 'Pausar' : 'Reativar'} ${a.nome}`}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="fantasma" size="icone-sm" aria-label={`Ações de ${a.nome}`}>
                                <MoreVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setAssinaturaEditando(a);
                                  setAssinaturaDialog(true);
                                }}
                              >
                                <Pencil />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem destrutivo onSelect={() => setExcluirAssinatura(a)}>
                                <Trash2 />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EstadoVazio
                      icone={Repeat}
                      titulo="Nenhuma assinatura cadastrada"
                      descricao="Streaming, academia, seguro, armazenamento em nuvem — cadastre uma vez e a cobrança aparece todo mês sem você lembrar."
                      acao={
                        <Button
                          onClick={() => {
                            setAssinaturaEditando(null);
                            setAssinaturaDialog(true);
                          }}
                        >
                          <Plus />
                          Cadastrar assinatura
                        </Button>
                      }
                      className="py-10"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <DialogCartao aberto={cartaoDialog} onAbertoChange={setCartaoDialog} cartao={cartaoEditando} />
      <DialogAssinatura
        aberto={assinaturaDialog}
        onAbertoChange={setAssinaturaDialog}
        assinatura={assinaturaEditando}
      />
      <Confirmar
        aberto={Boolean(excluirCartao)}
        onAbertoChange={(v) => !v && setExcluirCartao(null)}
        titulo={`Excluir ${excluirCartao?.nome ?? 'o cartão'}?`}
        descricao="Os lançamentos feitos nele continuam no histórico, mas ficam sem cartão vinculado."
        rotuloConfirmar="Excluir cartão"
        onConfirmar={() => {
          if (excluirCartao) {
            removeCartao(excluirCartao.id);
            toast.success('Cartão excluído');
          }
        }}
      />
      <Confirmar
        aberto={Boolean(excluirAssinatura)}
        onAbertoChange={(v) => !v && setExcluirAssinatura(null)}
        titulo={`Excluir ${excluirAssinatura?.nome ?? 'a assinatura'}?`}
        descricao="As cobranças já lançadas continuam no histórico. Só a geração automática para."
        rotuloConfirmar="Excluir assinatura"
        onConfirmar={() => {
          if (excluirAssinatura) {
            removeAssinatura(excluirAssinatura.id);
            toast.success('Assinatura excluída');
          }
        }}
      />
    </div>
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
