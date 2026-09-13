'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { competenciaLegivel } from '@/lib/format';
import { competenciaDe } from '@/lib/utils';

/** Navegação mês a mês, usada no dashboard, nas finanças e nos cartões. */
export function SeletorCompetencia({
  valor,
  onChange,
  className,
}: {
  valor: string;
  onChange: (comp: string) => void;
  className?: string;
}) {
  const [ano, mes] = valor.split('-').map(Number);
  const mover = (passo: number) => {
    const alvo = new Date(ano, mes - 1 + passo, 1);
    onChange(competenciaDe(alvo.getFullYear(), alvo.getMonth() + 1));
  };

  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1 rounded-control border border-line bg-surface-raised p-1">
        <Button variant="fantasma" size="icone-sm" onClick={() => mover(-1)} aria-label="Mês anterior">
          <ChevronLeft />
        </Button>
        <span className="min-w-[9.5rem] px-1 text-center text-[13px] font-medium">
          {competenciaLegivel(valor)}
        </span>
        <Button variant="fantasma" size="icone-sm" onClick={() => mover(1)} aria-label="Próximo mês">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
