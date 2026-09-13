'use client';
import { cn } from '@/lib/utils';

export function Progress({
  valor,
  className,
  cor,
  rotulo,
}: {
  valor: number;
  className?: string;
  cor?: string;
  rotulo?: string;
}) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(valor) ? valor : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo}
      className={cn('h-2 w-full overflow-hidden rounded-pill bg-surface-sunken', className)}
    >
      <div
        className="h-full rounded-pill transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: cor ?? 'hsl(var(--cedula))' }}
      />
    </div>
  );
}
