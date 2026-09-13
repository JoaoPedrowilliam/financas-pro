'use client';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { parseValor } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Entrada de dinheiro em pt-BR.
 * Aceita "1.234,56", "1234.56" e "R$ 80" e devolve sempre number.
 * Formata ao sair do campo, não a cada tecla — reformatar durante a digitação
 * move o cursor e é uma das coisas mais irritantes num formulário financeiro.
 */
export const CampoValor = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value: number;
    onChange: (valor: number) => void;
  }
>(({ value, onChange, className, ...props }, ref) => {
  const [texto, setTexto] = React.useState(() => (value ? value.toFixed(2).replace('.', ',') : ''));
  const [focado, setFocado] = React.useState(false);

  React.useEffect(() => {
    if (!focado) setTexto(value ? value.toFixed(2).replace('.', ',') : '');
  }, [value, focado]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
        R$
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        value={texto}
        placeholder="0,00"
        onFocus={() => setFocado(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange(parseValor(e.target.value));
        }}
        onBlur={() => {
          setFocado(false);
          const n = parseValor(texto);
          onChange(n);
          setTexto(n ? n.toFixed(2).replace('.', ',') : '');
        }}
        className={cn('cifra pl-9 text-right', className)}
        {...props}
      />
    </div>
  );
});
CampoValor.displayName = 'CampoValor';
