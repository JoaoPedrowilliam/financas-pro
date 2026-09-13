'use client';
import { useFinancas } from '@/store/use-financas';
import { moeda } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Exibe dinheiro respeitando o modo "ocultar valores".
 * Toda cifra da interface passa por aqui — assim o modo privacidade
 * nunca deixa escapar um número esquecido numa tela.
 */
export function Valor({
  valor,
  className,
  colorido,
  compacto,
  sinal,
}: {
  valor: number;
  className?: string;
  /** Verde para positivo, coral para negativo. */
  colorido?: boolean;
  compacto?: boolean;
  sinal?: boolean;
}) {
  const oculto = useFinancas((s) => s.perfil.ocultarValores);
  const tom = !colorido ? '' : valor > 0 ? 'text-cedula' : valor < 0 ? 'text-coral' : 'text-ink-muted';
  return (
    <span className={cn('cifra', tom, className)}>
      {moeda(valor, { oculto, compacto, sinal })}
    </span>
  );
}
