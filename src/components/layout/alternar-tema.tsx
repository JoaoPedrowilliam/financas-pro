'use client';
import * as React from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPCOES = [
  { valor: 'light', rotulo: 'Claro', icone: Sun },
  { valor: 'dark', rotulo: 'Escuro', icone: Moon },
  { valor: 'system', rotulo: 'Seguir o sistema', icone: Monitor },
] as const;

export function AlternarTema() {
  const { theme, setTheme } = useTheme();
  const [montado, setMontado] = React.useState(false);
  React.useEffect(() => setMontado(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="fantasma" size="icone" aria-label="Trocar tema">
          {/* Antes de hidratar não sabemos o tema; o par de ícones com CSS evita o piscar. */}
          <Sun className="size-[18px] dark:hidden" />
          <Moon className="hidden size-[18px] dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Aparência</DropdownMenuLabel>
        {OPCOES.map((o) => {
          const Icone = o.icone;
          return (
            <DropdownMenuItem
              key={o.valor}
              onSelect={() => setTheme(o.valor)}
              className={montado && theme === o.valor ? 'bg-surface-sunken font-medium' : undefined}
            >
              <Icone />
              {o.rotulo}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
