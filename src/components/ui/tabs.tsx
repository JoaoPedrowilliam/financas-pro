'use client';
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

/**
 * O invólucro rola na horizontal: com quatro abas o grupo passa de 375px e, sem
 * isso, empurrava a página inteira para o lado no celular.
 */
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1 scroll-fino [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex w-max items-center gap-1 rounded-control bg-surface-sunken p-1 text-ink-muted',
        className,
      )}
      {...props}
    />
  </div>
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-all',
      'data-[state=active]:bg-surface-raised data-[state=active]:text-ink data-[state=active]:shadow-sm',
      'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 focus-visible:outline-none animate-fade-in', className)}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
