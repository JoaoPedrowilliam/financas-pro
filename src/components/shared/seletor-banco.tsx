'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogoBanco } from './logo-banco';
import { BANCO_GENERICO, OPCOES_BANCO, bancoPorId } from '@/lib/bancos';

/**
 * Campo único de escolha de instituição, usado por contas e cartões.
 * Mostra a marca no gatilho e em cada opção — dá para reconhecer o banco de
 * relance, sem ler.
 */
export function SeletorBanco({
  id,
  valor,
  onChange,
  className,
}: {
  id?: string;
  valor: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const selecionado = bancoPorId(valor);

  return (
    <Select value={valor || BANCO_GENERICO.id} onValueChange={onChange}>
      <SelectTrigger id={id} className={className} aria-label="Banco">
        <SelectValue>
          <span className="flex items-center gap-2">
            <LogoBanco banco={selecionado ?? BANCO_GENERICO} tamanho="sm" />
            <span className="truncate">{(selecionado ?? BANCO_GENERICO).nome}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {OPCOES_BANCO.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            <span className="flex items-center gap-2.5">
              <LogoBanco banco={b} tamanho="sm" />
              {b.nome}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
