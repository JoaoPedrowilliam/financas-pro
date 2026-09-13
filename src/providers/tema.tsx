'use client';
import * as React from 'react';
import { ThemeProvider as NextThemes } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';

export function Provedores({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={250}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                'group rounded-control border border-line bg-surface-raised text-ink shadow-float text-sm',
              description: 'text-ink-muted',
              actionButton: 'bg-cedula text-cedula-fg',
            },
          }}
        />
      </TooltipProvider>
    </NextThemes>
  );
}
