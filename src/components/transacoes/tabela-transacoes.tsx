'use client';

import * as React from 'react';
import {
  ArrowLeftRight, ArrowUpDown, Check, Clock, MoreVertical, Paperclip,
  Pencil, Trash2, TrendingDown, TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Valor } from '@/components/shared/valor';
import { useFinancas } from '@/store/use-financas';
import { dataCurta } from '@/lib/format';
import { cn, dataDe } from '@/lib/utils';
import type { Transacao } from '@/types';

type Coluna = 'data' | 'descricao' | 'valor';

const ICONES = {
  receita: { icone: TrendingUp, classe: 'bg-cedula-soft text-cedula-ink' },
  despesa: { icone: TrendingDown, classe: 'bg-coral-soft text-coral' },
  transferencia: { icone: ArrowLeftRight, classe: 'bg-aco-soft text-aco' },
} as const;

export function TabelaTransacoes({
  transacoes,
  onEditar,
  onExcluir,
}: {
  transacoes: Transacao[];
  onEditar: (t: Transacao) => void;
  onExcluir: (t: Transacao) => void;
}) {
  const { categorias, contas, cartoes, alternarStatus } = useFinancas();
  const [ordem, setOrdem] = React.useState<{ coluna: Coluna; desc: boolean }>({
    coluna: 'data',
    desc: true,
  });

  const ordenadas = React.useMemo(() => {
    const copia = [...transacoes];
    copia.sort((a, b) => {
      let r = 0;
      if (ordem.coluna === 'data') r = a.data.localeCompare(b.data);
      else if (ordem.coluna === 'descricao') r = a.descricao.localeCompare(b.descricao, 'pt-BR');
      else r = a.valor - b.valor;
      return ordem.desc ? -r : r;
    });
    return copia;
  }, [transacoes, ordem]);

  // Agrupamento por dia: dá ritmo de leitura numa lista longa sem inventar separadores.
  const porDia = React.useMemo(() => {
    if (ordem.coluna !== 'data') return null;
    const grupos: { data: string; itens: Transacao[] }[] = [];
    for (const t of ordenadas) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.data === t.data) ultimo.itens.push(t);
      else grupos.push({ data: t.data, itens: [t] });
    }
    return grupos;
  }, [ordenadas, ordem.coluna]);

  const alternarOrdem = (coluna: Coluna) =>
    setOrdem((o) => ({ coluna, desc: o.coluna === coluna ? !o.desc : true }));

  const nomeDe = (t: Transacao) => {
    if (t.cartaoId) return cartoes.find((c) => c.id === t.cartaoId)?.nome ?? '—';
    return contas.find((c) => c.id === t.contaId)?.nome ?? '—';
  };

  const categoriaDe = (t: Transacao) => categorias.find((c) => c.id === t.categoriaId);

  const linha = (t: Transacao) => {
    const { icone: Icone, classe } = ICONES[t.tipo];
    const categoria = categoriaDe(t);
    const atrasada = t.status !== 'pago' && t.tipo === 'despesa' && dataDe(t.data) < new Date();

    return (
      <li
        key={t.id}
        className="group flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0 hover:bg-surface-sunken"
      >
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-control', classe)}>
          <Icone className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[13.5px] font-medium">{t.descricao}</p>
            {t.anexos.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0 text-ink-faint">
                    <Paperclip className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t.anexos.length} {t.anexos.length === 1 ? 'anexo' : 'anexos'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="truncate text-[11.5px] text-ink-faint">
            {categoria && (
              <>
                <span
                  className="mr-1 inline-block size-2 rounded-full align-middle"
                  style={{ background: categoria.cor }}
                />
                {categoria.nome} ·{' '}
              </>
            )}
            {nomeDe(t)}
            {t.parcela ? ` · ${t.parcela.numero}/${t.parcela.total}` : ''}
          </p>
        </div>

        <div className="hidden shrink-0 sm:block">
          {t.status === 'pago' ? (
            <Badge tom="positivo">
              <Check />
              pago
            </Badge>
          ) : atrasada ? (
            <Badge tom="critico">atrasado</Badge>
          ) : (
            <Badge tom="aviso">
              <Clock />
              pendente
            </Badge>
          )}
        </div>

        <span className="w-10 shrink-0 text-right text-[11.5px] text-ink-faint sm:w-12">
          {dataCurta(t.data)}
        </span>

        <Valor
          valor={t.tipo === 'despesa' ? -t.valor : t.valor}
          colorido={t.tipo !== 'transferencia'}
          sinal
          className="w-24 shrink-0 text-right text-[13.5px] font-semibold sm:w-28"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="fantasma"
              size="icone-sm"
              className="shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Ações de ${t.descricao}`}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => alternarStatus(t.id)}>
              {t.status === 'pago' ? <Clock /> : <Check />}
              Marcar como {t.status === 'pago' ? 'pendente' : 'pago'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEditar(t)}>
              <Pencil />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem destrutivo onSelect={() => onExcluir(t)}>
              <Trash2 />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11.5px] text-ink-muted">
        {(['data', 'descricao', 'valor'] as Coluna[]).map((c) => (
          <button
            key={c}
            onClick={() => alternarOrdem(c)}
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:text-ink',
              ordem.coluna === c && 'font-medium text-ink',
            )}
            aria-label={`Ordenar por ${c}`}
          >
            {c === 'data' ? 'Data' : c === 'descricao' ? 'Descrição' : 'Valor'}
            <ArrowUpDown className="size-3" />
          </button>
        ))}
        <span className="ml-auto cifra">
          {transacoes.length} {transacoes.length === 1 ? 'lançamento' : 'lançamentos'}
        </span>
      </div>

      {porDia ? (
        <div>
          {porDia.map((grupo) => (
            <section key={grupo.data}>
              <p className="sticky top-16 z-10 bg-surface-sunken px-3 py-1.5 text-[11.5px] font-medium text-ink-muted">
                {new Intl.DateTimeFormat('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'long',
                }).format(dataDe(grupo.data))}
              </p>
              <ul>{grupo.itens.map(linha)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <ul>{ordenadas.map(linha)}</ul>
      )}
    </div>
  );
}
