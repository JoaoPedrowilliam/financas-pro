'use client';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const botao = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-[background-color,color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.985]',
  {
    variants: {
      variant: {
        primario: 'bg-cedula text-cedula-fg shadow-sm hover:bg-cedula/90',
        neutro: 'bg-surface-sunken text-ink hover:bg-line',
        contorno: 'border border-line-strong bg-transparent text-ink hover:bg-surface-sunken',
        fantasma: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        perigo: 'bg-coral-strong text-coral-fg hover:bg-coral-strong/90',
        link: 'text-cedula underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4',
        lg: 'h-11 px-6 text-[15px]',
        icone: 'h-9 w-9',
        'icone-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'primario', size: 'md' },
  },
);

export interface BotaoProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof botao> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, BotaoProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(botao({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';
export { botao };
