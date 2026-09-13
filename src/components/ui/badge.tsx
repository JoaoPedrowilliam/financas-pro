import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const etiqueta = cva(
  'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-medium leading-5 [&_svg]:size-3',
  {
    variants: {
      tom: {
        neutro: 'border-line bg-surface-sunken text-ink-muted',
        positivo: 'border-transparent bg-cedula-soft text-cedula-ink',
        aviso: 'border-transparent bg-ambar-soft text-ambar',
        critico: 'border-transparent bg-coral-soft text-coral',
        info: 'border-transparent bg-aco-soft text-aco',
        roxo: 'border-transparent bg-violeta-soft text-violeta',
      },
    },
    defaultVariants: { tom: 'neutro' },
  },
);

export const Badge = ({
  className,
  tom,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof etiqueta>) => (
  <span className={cn(etiqueta({ tom }), className)} {...props} />
);
