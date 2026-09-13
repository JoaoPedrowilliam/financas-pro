import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink transition-colors',
        'placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-50',
        'focus:border-cedula focus:outline-none focus:ring-2 focus:ring-cedula/25',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-control border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink',
        'placeholder:text-ink-faint focus:border-cedula focus:outline-none focus:ring-2 focus:ring-cedula/25',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
