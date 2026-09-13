'use client';

import * as React from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogoBanco } from '@/components/shared/logo-banco';
import { Valor } from '@/components/shared/valor';
import { nomeInstituicao } from '@/lib/bancos';
import { cn } from '@/lib/utils';
import type { Conta, TipoConta } from '@/types';

export const ROTULO_TIPO_CONTA: Record<TipoConta, string> = {
  corrente: 'Conta corrente',
  digital: 'Conta digital',
  poupanca: 'Poupança',
  investimento: 'Conta de investimento',
  carteira: 'Dinheiro em espécie',
};

/**
 * Card de conta bancária.
 * Hierarquia: marca e banco identificam, o saldo é o número que a pessoa
 * veio buscar — por isso ele fica sozinho na linha de baixo, em corpo grande.
 */
export function CartaoConta({
  conta,
  saldo,
  onEditar,
  onExcluir,
}: {
  conta: Conta;
  saldo: number;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <div className="painel painel-interativo flex flex-col p-4">
      <div className="flex items-start gap-3">
        <LogoBanco registro={conta} tamanho="md" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-tight">{nomeInstituicao(conta)}</p>
          <p className="truncate text-[12.5px] text-ink-muted">{conta.nome}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="fantasma" size="icone-sm" aria-label={`Ações de ${conta.nome}`}>
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEditar}>
              <Pencil />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem destrutivo onSelect={onExcluir}>
              <Trash2 />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-5">
        <Valor
          valor={saldo}
          className={cn(
            'block font-display text-[24px] font-semibold leading-none tracking-tight',
            saldo < 0 && 'text-coral',
          )}
        />
        <p className="mt-1.5 text-[11.5px] text-ink-faint">
          {ROTULO_TIPO_CONTA[conta.tipo]}
          {!conta.incluirNoPatrimonio ? ' · fora do patrimônio' : ''}
        </p>
      </div>
    </div>
  );
}
