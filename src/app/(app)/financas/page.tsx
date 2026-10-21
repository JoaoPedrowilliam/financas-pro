'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeftRight, Download, FilterX, Plus, Search, SlidersHorizontal,
} from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { Confirmar } from '@/components/shared/confirmar';
import { Valor } from '@/components/shared/valor';
import { TabelaTransacoes } from '@/components/transacoes/tabela-transacoes';
import { DialogTransacao } from '@/components/transacoes/dialog-transacao';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinancas } from '@/store/use-financas';
import { useAcao } from '@/lib/acoes';
import { exportarTransacoesCSV } from '@/lib/exportar';
import { MESES_CURTOS, SLUGS_MES, competenciaDe, somar } from '@/lib/utils';
import type { StatusTransacao, TipoTransacao, Transacao } from '@/types';

export default function PaginaFinancas() {
  return (
    <React.Suspense fallback={null}>
      <ConteudoFinancas />
    </React.Suspense>
  );
}

function ConteudoFinancas() {
  const parametros = useSearchParams();
  const { transacoes, categorias, contas, cartoes, removeTransacao, removeGrupoParcelas } = useFinancas();
  const { executar } = useAcao();

  const [busca, setBusca] = React.useState(parametros.get('busca') ?? '');
  const [tipo, setTipo] = React.useState<TipoTransacao | 'todos'>('todos');
  const [status, setStatus] = React.useState<StatusTransacao | 'todos'>('todos');
  const [categoriaId, setCategoriaId] = React.useState('todas');
  const [origemId, setOrigemId] = React.useState('todas');
  const [de, setDe] = React.useState('');
  const [ate, setAte] = React.useState('');
  const [filtrosAbertos, setFiltrosAbertos] = React.useState(false);

  const [editando, setEditando] = React.useState<Transacao | null>(null);
  const [dialogAberto, setDialogAberto] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState<Transacao | null>(null);

  const ano = new Date().getFullYear();

  const filtradas = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return transacoes.filter((t) => {
      if (tipo !== 'todos' && t.tipo !== tipo) return false;
      if (status !== 'todos' && t.status !== status) return false;
      if (categoriaId !== 'todas' && t.categoriaId !== categoriaId) return false;
      if (origemId !== 'todas' && t.contaId !== origemId && t.cartaoId !== origemId) return false;
      if (de && t.data < de) return false;
      if (ate && t.data > ate) return false;
      if (!termo) return true;

      // A busca cobre descrição, observação, etiquetas e o valor digitado.
      const categoria = categorias.find((c) => c.id === t.categoriaId)?.nome ?? '';
      const alvo = [t.descricao, t.observacao ?? '', categoria, ...t.etiquetas]
        .join(' ')
        .toLowerCase();
      return alvo.includes(termo) || t.valor.toFixed(2).includes(termo.replace(',', '.'));
    });
  }, [transacoes, busca, tipo, status, categoriaId, origemId, de, ate, categorias]);

  const receitas = somar(filtradas.filter((t) => t.tipo === 'receita'), (t) => t.valor);
  const despesas = somar(filtradas.filter((t) => t.tipo === 'despesa'), (t) => t.valor);

  const temFiltro =
    busca || tipo !== 'todos' || status !== 'todos' || categoriaId !== 'todas' ||
    origemId !== 'todas' || de || ate;

  const limpar = () => {
    setBusca('');
    setTipo('todos');
    setStatus('todos');
    setCategoriaId('todas');
    setOrigemId('todas');
    setDe('');
    setAte('');
  };

  const exportar = () => {
    exportarTransacoesCSV(
      filtradas,
      (id) => categorias.find((c) => c.id === id)?.nome ?? 'Sem categoria',
      (id) =>
        contas.find((c) => c.id === id)?.nome ?? cartoes.find((c) => c.id === id)?.nome ?? '—',
    );
    toast.success(`${filtradas.length} lançamentos exportados`);
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Finanças"
        descricao="Tudo que entrou e saiu. Filtre, busque e ajuste o que precisar."
        acoes={
          <>
            <Button variant="contorno" onClick={exportar} disabled={!filtradas.length}>
              <Download />
              Exportar CSV
            </Button>
            <Button
              onClick={() => {
                setEditando(null);
                setDialogAberto(true);
              }}
            >
              <Plus />
              Novo lançamento
            </Button>
          </>
        }
      />

      {/* Atalhos mensais: entram direto na página do mês com comparativo. */}
      <div className="flex flex-wrap gap-1.5">
        {MESES_CURTOS.map((m, i) => (
          <Button key={m} asChild variant="contorno" size="sm">
            <Link href={`/financas/${SLUGS_MES[i]}?ano=${ano}`}>{m}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por descrição, categoria, etiqueta ou valor"
                className="pl-9"
                aria-label="Buscar lançamentos"
              />
            </div>
            <Button
              variant="contorno"
              onClick={() => setFiltrosAbertos((v) => !v)}
              aria-expanded={filtrosAbertos}
            >
              <SlidersHorizontal />
              Filtros
              {temFiltro && <Badge tom="positivo">ativo</Badge>}
            </Button>
            {temFiltro && (
              <Button variant="fantasma" onClick={limpar}>
                <FilterX />
                Limpar
              </Button>
            )}
          </div>

          {filtrosAbertos && (
            <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="f-tipo">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                  <SelectTrigger id="f-tipo" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="receita">Receitas</SelectItem>
                    <SelectItem value="despesa">Despesas</SelectItem>
                    <SelectItem value="transferencia">Transferências</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="f-status">Situação</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger id="f-status" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="pago">Pagos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="f-categoria">Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger id="f-categoria" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {categorias
                      .filter((c) => !c.arquivada)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.paiId ? `— ${c.nome}` : c.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="f-origem">Conta ou cartão</Label>
                <Select value={origemId} onValueChange={setOrigemId}>
                  <SelectTrigger id="f-origem" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todos</SelectItem>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                    {cartoes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="f-de">De</Label>
                <Input id="f-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="f-ate">Até</Label>
                <Input id="f-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="mt-1.5" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line pt-3 text-[13px]">
            <span className="text-ink-muted">
              Entradas <Valor valor={receitas} className="font-semibold text-cedula" />
            </span>
            <span className="text-ink-muted">
              Saídas <Valor valor={despesas} className="font-semibold text-coral" />
            </span>
            <span className="text-ink-muted">
              Resultado <Valor valor={receitas - despesas} colorido className="font-semibold" />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* overflow-clip, não overflow-hidden: `hidden` faz do card um contêiner de
          rolagem, e o cabeçalho sticky do dia passa a se posicionar contra ele —
          caindo 33px por cima da primeira linha mesmo sem rolagem. `clip`
          recorta os cantos igual, sem criar contêiner de rolagem. */}
      <Card className="overflow-clip">
        {filtradas.length ? (
          <TabelaTransacoes
            transacoes={filtradas}
            onEditar={(t) => {
              setEditando(t);
              setDialogAberto(true);
            }}
            onExcluir={setExcluindo}
          />
        ) : (
          <EstadoVazio
            icone={ArrowLeftRight}
            titulo={temFiltro ? 'Nenhum lançamento com esses filtros' : 'Nenhum lançamento ainda'}
            descricao={
              temFiltro
                ? 'Tente ampliar o período ou remover um dos filtros para ver mais resultados.'
                : 'Registre a primeira entrada ou saída para começar a acompanhar seu mês.'
            }
            acao={
              temFiltro ? (
                <Button variant="contorno" onClick={limpar}>
                  <FilterX />
                  Limpar filtros
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditando(null);
                    setDialogAberto(true);
                  }}
                >
                  <Plus />
                  Novo lançamento
                </Button>
              )
            }
          />
        )}
      </Card>

      <DialogTransacao aberto={dialogAberto} onAbertoChange={setDialogAberto} transacao={editando} />

      <Confirmar
        aberto={Boolean(excluindo)}
        onAbertoChange={(v) => !v && setExcluindo(null)}
        titulo={
          excluindo?.parcela
            ? `Excluir as ${excluindo.parcela.total} parcelas?`
            : 'Excluir este lançamento?'
        }
        descricao={
          excluindo?.parcela
            ? 'Este lançamento faz parte de uma compra parcelada. Todas as parcelas do grupo serão removidas.'
            : 'O lançamento sai do histórico e dos totais. Isso não pode ser desfeito.'
        }
        rotuloConfirmar={excluindo?.parcela ? 'Excluir todas' : 'Excluir'}
        onConfirmar={() => {
          if (!excluindo) return;
          const parcela = excluindo.parcela;
          executar(
            () =>
              parcela ? removeGrupoParcelas(parcela.grupoId) : removeTransacao(excluindo.id),
            {
              sucesso: parcela ? 'Parcelas excluídas' : 'Lançamento excluído',
              aoFalhar: 'Não foi possível excluir',
            },
          );
        }}
      />
    </div>
  );
}
