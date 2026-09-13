'use client';

import * as React from 'react';
import { ArrowLeftRight, CreditCard, Minus, Plus } from 'lucide-react';
import { DialogTransacao } from '@/components/transacoes/dialog-transacao';
import { useFinancas } from '@/store/use-financas';
import { cn } from '@/lib/utils';
import type { TipoTransacao } from '@/types';

type Atalho = 'receita' | 'despesa' | 'cartao' | 'transferencia';

const ATALHOS: {
  chave: Atalho;
  rotulo: string;
  icone: typeof Plus;
  tipo: TipoTransacao;
  classe: string;
}[] = [
  {
    chave: 'receita',
    rotulo: 'Receita',
    icone: Plus,
    tipo: 'receita',
    classe: 'bg-cedula-soft text-cedula-ink group-hover:bg-cedula group-hover:text-cedula-fg',
  },
  {
    chave: 'despesa',
    rotulo: 'Despesa',
    icone: Minus,
    tipo: 'despesa',
    classe: 'bg-coral-soft text-coral group-hover:bg-coral group-hover:text-coral-fg',
  },
  {
    chave: 'cartao',
    rotulo: 'Cartão',
    icone: CreditCard,
    tipo: 'despesa',
    classe: 'bg-surface-sunken text-ink-muted group-hover:bg-ink group-hover:text-surface-raised',
  },
  {
    chave: 'transferencia',
    rotulo: 'Transferência',
    icone: ArrowLeftRight,
    tipo: 'transferencia',
    classe: 'bg-surface-sunken text-ink-muted group-hover:bg-ink group-hover:text-surface-raised',
  },
];

/**
 * Atalhos de lançamento no dashboard.
 * Não duplicam nada: cada botão abre o MESMO `DialogTransacao` do topo da tela,
 * só que já com o tipo (e, no caso do cartão, o cartão) escolhido.
 */
export function AcoesRapidas({ className }: { className?: string }) {
  const cartoes = useFinancas((s) => s.cartoes);
  const [aberto, setAberto] = React.useState<Atalho | null>(null);

  const primeiroCartao = cartoes.find((c) => !c.arquivado && c.tipo !== 'debito');
  const atalhoAtivo = ATALHOS.find((a) => a.chave === aberto);

  return (
    <>
      <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4', className)}>
        {ATALHOS.map((a) => {
          const Icone = a.icone;
          return (
            <button
              key={a.chave}
              type="button"
              onClick={() => setAberto(a.chave)}
              className="painel group flex items-center gap-2.5 p-3 text-left transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-surface-sunken/60"
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-control transition-colors duration-150',
                  a.classe,
                )}
              >
                <Icone className="size-4" />
              </span>
              <span className="min-w-0 truncate text-[13px] font-medium">{a.rotulo}</span>
            </button>
          );
        })}
      </div>

      {/* Um diálogo só, remontado a cada atalho — o `key` garante que ele reabra
          com o rascunho certo em vez de reaproveitar o anterior. */}
      {atalhoAtivo && (
        <DialogTransacao
          key={atalhoAtivo.chave}
          aberto
          onAbertoChange={(v) => !v && setAberto(null)}
          tipoInicial={atalhoAtivo.tipo}
          cartaoInicial={atalhoAtivo.chave === 'cartao' ? primeiroCartao?.id : undefined}
        />
      )}
    </>
  );
}
