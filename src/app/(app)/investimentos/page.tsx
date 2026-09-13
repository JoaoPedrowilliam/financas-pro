'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ArrowDownRight, ArrowUpRight, LineChart, MoreVertical, Pencil, Plus, RefreshCw, Trash2,
} from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { Confirmar } from '@/components/shared/confirmar';
import { Valor } from '@/components/shared/valor';
import { CampoValor } from '@/components/shared/campo-valor';
import { DicaGrafico } from '@/components/dashboard/dica-grafico';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFinancas } from '@/store/use-financas';
import { alocacaoPorClasse, resultadoCarteira } from '@/lib/financas';
import { moeda, numero, percentual } from '@/lib/format';
import { hojeISO } from '@/lib/utils';
import type { Ativo, ClasseAtivo } from '@/types';

const CLASSES: { valor: ClasseAtivo; rotulo: string; cor: string }[] = [
  { valor: 'acao', rotulo: 'Ações', cor: 'hsl(var(--cedula))' },
  { valor: 'fii', rotulo: 'Fundos imobiliários', cor: 'hsl(var(--aco))' },
  { valor: 'etf', rotulo: 'ETFs', cor: 'hsl(var(--violeta))' },
  { valor: 'bdr', rotulo: 'BDRs', cor: 'hsl(var(--ambar))' },
  { valor: 'renda-fixa', rotulo: 'Renda fixa', cor: 'hsl(var(--graf-4))' },
  { valor: 'cripto', rotulo: 'Criptomoedas', cor: 'hsl(var(--coral))' },
];

const rotuloClasse = (c: ClasseAtivo) => CLASSES.find((x) => x.valor === c)?.rotulo ?? c;
const corClasse = (c: ClasseAtivo) => CLASSES.find((x) => x.valor === c)?.cor ?? 'hsl(var(--ink-faint))';

export default function PaginaInvestimentos() {
  const { ativos, perfil, removeAtivo, aplicarCotacoes } = useFinancas();

  const [dialogAberto, setDialogAberto] = React.useState(false);
  const [editando, setEditando] = React.useState<Ativo | null>(null);
  const [excluindo, setExcluindo] = React.useState<Ativo | null>(null);
  const [atualizando, setAtualizando] = React.useState(false);
  const [filtro, setFiltro] = React.useState<ClasseAtivo | 'todas'>('todas');

  const resultado = React.useMemo(() => resultadoCarteira(ativos), [ativos]);
  const alocacao = React.useMemo(() => alocacaoPorClasse(ativos), [ativos]);
  const visiveis = filtro === 'todas' ? ativos : ativos.filter((a) => a.classe === filtro);

  const atualizarCotacoes = async () => {
    if (!ativos.length) return;
    setAtualizando(true);
    try {
      const tickers = ativos.map((a) => a.ticker).join(',');
      const resposta = await fetch(`/api/cotacoes?tickers=${encodeURIComponent(tickers)}`);
      // Numa publicação estática (GitHub Pages) a rota não existe: vale avisar o
      // motivo em vez de deixar um "404" cru na tela.
      if (resposta.status === 404) {
        throw new Error(
          'Esta versão está publicada como site estático, sem servidor. Os preços já salvos continuam valendo; para atualizar automaticamente, rode o projeto localmente ou publique numa hospedagem com Node.',
        );
      }
      if (!resposta.ok) throw new Error(`API respondeu ${resposta.status}`);

      const dados = (await resposta.json()) as {
        cotacoes: { ticker: string; preco: number; variacao: number | null; fonte: string }[];
        avisos: string[];
      };

      const precoAtualDe = new Map(ativos.map((a) => [a.ticker.toUpperCase(), a.precoAtual || a.precoMedio]));

      const mapa = Object.fromEntries(
        dados.cotacoes.map((c) => {
          // Cotação real: usa o preço do provedor.
          // Simulada: aplica só a variação sobre o preço que já temos, senão
          // um ativo de R$ 370 mil viraria R$ 100.
          const base = precoAtualDe.get(c.ticker) ?? c.preco;
          const preco =
            c.fonte === 'simulado'
              ? Math.round(base * (1 + (c.variacao ?? 0) / 100) * 100) / 100
              : c.preco;
          return [c.ticker, { preco }];
        }),
      );
      aplicarCotacoes(mapa);

      const simulados = dados.cotacoes.filter((c) => c.fonte === 'simulado').length;
      toast.success(`${dados.cotacoes.length} cotações atualizadas`, {
        description: simulados
          ? `${simulados} vieram simuladas. Configure BRAPI_TOKEN no .env para dados reais da B3.`
          : undefined,
      });
    } catch (erro) {
      toast.error('Não foi possível atualizar as cotações', {
        description:
          erro instanceof Error ? erro.message : 'Verifique sua conexão e tente de novo.',
      });
    } finally {
      setAtualizando(false);
    }
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Investimentos"
        descricao="Sua carteira a preço de mercado, com resultado, alocação e proventos projetados."
        acoes={
          <>
            <Button variant="contorno" onClick={atualizarCotacoes} disabled={atualizando || !ativos.length}>
              <RefreshCw className={atualizando ? 'animate-spin' : undefined} />
              {atualizando ? 'Atualizando…' : 'Atualizar cotações'}
            </Button>
            <Button
              onClick={() => {
                setEditando(null);
                setDialogAberto(true);
              }}
            >
              <Plus />
              Novo ativo
            </Button>
          </>
        }
      />

      {ativos.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={LineChart}
            titulo="Carteira vazia"
            descricao="Cadastre seus ativos com quantidade e preço médio. As cotações são buscadas depois, e o resultado é calculado a partir delas."
            acao={
              <Button
                onClick={() => {
                  setEditando(null);
                  setDialogAberto(true);
                }}
              >
                <Plus />
                Cadastrar ativo
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
            <section className="painel p-6 shadow-raised sm:p-7">
              <p className="text-[13px] font-medium text-ink-muted">Valor da carteira hoje</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <Valor
                  valor={resultado.mercado}
                  className="font-display text-cifra font-semibold tracking-tight"
                />
                <span
                  className={`inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[13px] font-medium ${
                    resultado.lucro >= 0 ? 'bg-cedula-soft text-cedula-ink' : 'bg-coral-soft text-coral'
                  }`}
                >
                  {resultado.lucro >= 0 ? (
                    <ArrowUpRight className="size-3.5" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  {percentual(resultado.rentabilidade, 2)}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Dado rotulo="Você investiu" valor={resultado.custo} />
                <Dado
                  rotulo={resultado.lucro >= 0 ? 'Lucro não realizado' : 'Prejuízo não realizado'}
                  valor={resultado.lucro}
                  tom={resultado.lucro >= 0 ? 'positivo' : 'critico'}
                />
                <Dado
                  rotulo="Proventos em 12 meses"
                  valor={resultado.proventos12m}
                  nota="projeção pelo DY informado"
                />
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Alocação por classe</CardTitle>
                <CardDescription>Onde seu dinheiro está distribuído.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="mx-auto size-[148px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={alocacao.map((a) => ({ nome: rotuloClasse(a.classe), valor: a.valor }))}
                          dataKey="valor"
                          nameKey="nome"
                          innerRadius={46}
                          outerRadius={70}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {alocacao.map((a) => (
                            <Cell key={a.classe} fill={corClasse(a.classe)} />
                          ))}
                        </Pie>
                        <Tooltip content={<DicaGrafico oculto={perfil.ocultarValores} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-2">
                    {alocacao.map((a) => (
                      <li key={a.classe} className="flex items-center gap-2 text-[13px]">
                        <span
                          className="size-2.5 shrink-0 rounded-[3px]"
                          style={{ background: corClasse(a.classe) }}
                        />
                        <span className="min-w-0 flex-1 truncate text-ink-muted">
                          {rotuloClasse(a.classe)}
                        </span>
                        <span className="cifra shrink-0 text-[11px] text-ink-faint">
                          {a.participacao.toFixed(0)}%
                        </span>
                        <Valor valor={a.valor} compacto className="w-20 shrink-0 text-right font-medium" />
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Seus ativos</CardTitle>
                <CardDescription>
                  {visiveis.length} {visiveis.length === 1 ? 'posição' : 'posições'} na carteira.
                </CardDescription>
              </div>
              <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as classes</SelectItem>
                  {CLASSES.map((c) => (
                    <SelectItem key={c.valor} value={c.valor}>
                      {c.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              <ul>
                {visiveis.map((ativo) => {
                  const preco = ativo.precoAtual || ativo.precoMedio;
                  const valor = ativo.quantidade * preco;
                  const custo = ativo.quantidade * ativo.precoMedio;
                  const lucro = valor - custo;
                  const rent = custo > 0 ? (lucro / custo) * 100 : 0;
                  const peso = resultado.mercado > 0 ? (valor / resultado.mercado) * 100 : 0;

                  return (
                    <li
                      key={ativo.id}
                      className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0 hover:bg-surface-sunken"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="cifra text-[14px] font-semibold">{ativo.ticker}</p>
                          <Badge tom="neutro">{rotuloClasse(ativo.classe)}</Badge>
                          {ativo.dividendYield ? (
                            <Badge tom="positivo">DY {ativo.dividendYield.toFixed(1)}%</Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-[11.5px] text-ink-faint">
                          {ativo.nome}
                          {ativo.corretora ? ` · ${ativo.corretora}` : ''}
                          {ativo.taxa ? ` · ${ativo.taxa}` : ''}
                        </p>
                      </div>

                      <div className="hidden w-28 shrink-0 text-right sm:block">
                        <p className="cifra text-[13px]">{numero(ativo.quantidade, 8)}</p>
                        <p className="text-[11px] text-ink-faint">
                          PM {moeda(ativo.precoMedio, { oculto: perfil.ocultarValores })}
                        </p>
                      </div>

                      <div className="w-28 shrink-0 text-right">
                        <Valor valor={valor} className="block text-[14px] font-semibold" />
                        <p className={`cifra text-[11.5px] ${lucro >= 0 ? 'text-cedula' : 'text-coral'}`}>
                          {percentual(rent, 1)}
                        </p>
                      </div>

                      <div className="hidden w-24 shrink-0 sm:block">
                        <Progress
                          valor={peso}
                          cor={corClasse(ativo.classe)}
                          className="h-1.5"
                          rotulo={`Peso de ${ativo.ticker}`}
                        />
                        <p className="cifra mt-1 text-right text-[11px] text-ink-faint">
                          {peso.toFixed(1)}%
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="fantasma" size="icone-sm" aria-label={`Ações de ${ativo.ticker}`}>
                            <MoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditando(ativo);
                              setDialogAberto(true);
                            }}
                          >
                            <Pencil />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem destrutivo onSelect={() => setExcluindo(ativo)}>
                            <Trash2 />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      <DialogAtivo aberto={dialogAberto} onAbertoChange={setDialogAberto} ativo={editando} />

      <Confirmar
        aberto={Boolean(excluindo)}
        onAbertoChange={(v) => !v && setExcluindo(null)}
        titulo={`Remover ${excluindo?.ticker ?? 'o ativo'} da carteira?`}
        descricao="A posição sai do cálculo de patrimônio e de rentabilidade."
        rotuloConfirmar="Remover ativo"
        onConfirmar={() => {
          if (excluindo) {
            removeAtivo(excluindo.id);
            toast.success('Ativo removido');
          }
        }}
      />
    </div>
  );
}

function Dado({
  rotulo,
  valor,
  nota,
  tom = 'neutro',
}: {
  rotulo: string;
  valor: number;
  nota?: string;
  tom?: 'neutro' | 'positivo' | 'critico';
}) {
  const cor = tom === 'positivo' ? 'text-cedula-ink' : tom === 'critico' ? 'text-coral' : 'text-ink';
  return (
    <div>
      <p className="text-[11.5px] text-ink-muted">{rotulo}</p>
      <Valor valor={valor} className={`mt-0.5 block font-display text-[19px] font-semibold ${cor}`} />
      {nota ? <p className="text-[11px] text-ink-faint">{nota}</p> : null}
    </div>
  );
}

function DialogAtivo({
  aberto,
  onAbertoChange,
  ativo,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  ativo?: Ativo | null;
}) {
  const { addAtivo, updateAtivo } = useFinancas();
  const [form, setForm] = React.useState({
    ticker: '',
    nome: '',
    classe: 'acao' as ClasseAtivo,
    quantidade: 0,
    precoMedio: 0,
    precoAtual: 0,
    dividendYield: 0,
    taxa: '',
    vencimento: '',
    corretora: '',
  });
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    if (!aberto) return;
    setErro('');
    setForm(
      ativo
        ? {
            ticker: ativo.ticker,
            nome: ativo.nome,
            classe: ativo.classe,
            quantidade: ativo.quantidade,
            precoMedio: ativo.precoMedio,
            precoAtual: ativo.precoAtual,
            dividendYield: ativo.dividendYield ?? 0,
            taxa: ativo.taxa ?? '',
            vencimento: ativo.vencimento ?? '',
            corretora: ativo.corretora ?? '',
          }
        : {
            ticker: '', nome: '', classe: 'acao', quantidade: 0, precoMedio: 0,
            precoAtual: 0, dividendYield: 0, taxa: '', vencimento: '', corretora: '',
          },
    );
  }, [aberto, ativo]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const rendaFixa = form.classe === 'renda-fixa';

  const salvar = () => {
    if (!form.ticker.trim()) return setErro('Informe o código do ativo.');
    if (form.quantidade <= 0) return setErro('A quantidade precisa ser maior que zero.');
    if (form.precoMedio <= 0) return setErro('Informe o preço médio de compra.');

    const dados = {
      ticker: form.ticker.trim().toUpperCase(),
      nome: form.nome.trim() || form.ticker.trim().toUpperCase(),
      classe: form.classe,
      quantidade: form.quantidade,
      precoMedio: form.precoMedio,
      precoAtual: form.precoAtual || form.precoMedio,
      dividendYield: form.dividendYield || undefined,
      taxa: rendaFixa ? form.taxa.trim() || undefined : undefined,
      vencimento: rendaFixa ? form.vencimento || undefined : undefined,
      corretora: form.corretora.trim() || undefined,
    };

    if (ativo) {
      updateAtivo(ativo.id, dados);
      toast.success('Ativo atualizado');
    } else {
      addAtivo(dados);
      toast.success('Ativo adicionado à carteira');
    }
    onAbertoChange(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-xl">
        <DialogHeader>
          <DialogTitle>{ativo ? 'Editar ativo' : 'Novo ativo'}</DialogTitle>
          <DialogDescription>
            O preço atual pode ficar em branco — ele é preenchido quando você atualizar as cotações.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ticker">Código</Label>
            <Input
              id="ticker"
              value={form.ticker}
              onChange={(e) => set('ticker', e.target.value.toUpperCase())}
              placeholder="PETR4, MXRF11, BTC"
              className="cifra mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="classe">Classe</Label>
            <Select value={form.classe} onValueChange={(v) => set('classe', v as ClasseAtivo)}>
              <SelectTrigger id="classe" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => (
                  <SelectItem key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="nome-ativo">Nome</Label>
            <Input
              id="nome-ativo"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Petrobras PN"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="quantidade">Quantidade</Label>
            <Input
              id="quantidade"
              type="number"
              step="any"
              min={0}
              value={form.quantidade || ''}
              onChange={(e) => set('quantidade', Number(e.target.value))}
              className="cifra mt-1.5 text-right"
            />
          </div>

          <div>
            <Label htmlFor="preco-medio">Preço médio</Label>
            <div className="mt-1.5">
              <CampoValor id="preco-medio" value={form.precoMedio} onChange={(v) => set('precoMedio', v)} />
            </div>
          </div>

          <div>
            <Label htmlFor="preco-atual">Preço atual</Label>
            <div className="mt-1.5">
              <CampoValor id="preco-atual" value={form.precoAtual} onChange={(v) => set('precoAtual', v)} />
            </div>
          </div>

          <div>
            <Label htmlFor="dy">Dividend yield (% ao ano)</Label>
            <Input
              id="dy"
              type="number"
              step="0.1"
              min={0}
              value={form.dividendYield || ''}
              onChange={(e) => set('dividendYield', Number(e.target.value))}
              className="cifra mt-1.5 text-right"
            />
          </div>

          {rendaFixa && (
            <>
              <div>
                <Label htmlFor="taxa">Taxa contratada</Label>
                <Input
                  id="taxa"
                  value={form.taxa}
                  onChange={(e) => set('taxa', e.target.value)}
                  placeholder="112% do CDI, IPCA + 6%"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="venc-ativo">Vencimento</Label>
                <Input
                  id="venc-ativo"
                  type="date"
                  min={hojeISO()}
                  value={form.vencimento}
                  onChange={(e) => set('vencimento', e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <Label htmlFor="corretora">Corretora</Label>
            <Input
              id="corretora"
              value={form.corretora}
              onChange={(e) => set('corretora', e.target.value)}
              placeholder="Clear, Rico, Inter…"
              className="mt-1.5"
            />
          </div>
        </div>

        {erro && (
          <p role="alert" className="text-[12px] text-coral">
            {erro}
          </p>
        )}

        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{ativo ? 'Salvar alterações' : 'Adicionar ativo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
