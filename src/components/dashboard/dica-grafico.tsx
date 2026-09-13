'use client';
import { moeda } from '@/lib/format';

interface ItemDica {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

/** Tooltip única para todos os gráficos: mesma tipografia, mesmo formato de moeda. */
export function DicaGrafico({
  active,
  payload,
  label,
  oculto,
  sufixo,
}: {
  active?: boolean;
  payload?: ItemDica[];
  label?: string | number;
  oculto?: boolean;
  sufixo?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-control border border-line bg-surface-raised px-3 py-2 shadow-float">
      {label !== undefined && (
        <p className="mb-1 text-[12px] font-medium text-ink">{String(label)}</p>
      )}
      <ul className="space-y-0.5">
        {payload.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-[12px]">
            <span className="size-2 rounded-full" style={{ background: item.color }} />
            <span className="text-ink-muted">{item.name}</span>
            <span className="cifra ml-auto font-medium text-ink">
              {typeof item.value === 'number' ? moeda(item.value, { oculto }) : item.value}
              {sufixo}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
