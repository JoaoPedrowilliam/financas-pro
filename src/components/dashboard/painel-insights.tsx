'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, CircleAlert, Info, Lightbulb, TriangleAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import type { Insight } from '@/types';
import { cn } from '@/lib/utils';

const ESTILOS = {
  critico: { icone: CircleAlert, classe: 'bg-coral-soft text-coral' },
  atencao: { icone: TriangleAlert, classe: 'bg-ambar-soft text-ambar' },
  neutro: { icone: Info, classe: 'bg-aco-soft text-aco' },
  positivo: { icone: CheckCircle2, classe: 'bg-cedula-soft text-cedula-ink' },
} as const;

export function PainelInsights({ insights }: { insights: Insight[] }) {
  const [expandido, setExpandido] = React.useState(false);
  const semMovimento = useReducedMotion();
  const visiveis = expandido ? insights : insights.slice(0, 4);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>O que precisa da sua atenção</CardTitle>
        <CardDescription>
          Avisos gerados a partir dos seus lançamentos, atualizados a cada mudança.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        {insights.length === 0 ? (
          <EstadoVazio
            icone={Lightbulb}
            titulo="Nada fora do lugar"
            descricao="Quando algo sair da curva — gasto acima da média, fatura perto do vencimento, meta em risco — o aviso aparece aqui."
            className="py-10"
          />
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {visiveis.map((insight, i) => {
                const { icone: Icone, classe } = ESTILOS[insight.nivel];
                return (
                  <motion.li
                    key={insight.id}
                    layout={!semMovimento}
                    initial={semMovimento ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, delay: i > 3 ? 0 : 0 }}
                    className="flex gap-3 rounded-control border border-line p-3"
                  >
                    <span className={cn('grid size-7 shrink-0 place-items-center rounded-[9px]', classe)}>
                      <Icone className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug text-ink">{insight.titulo}</p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{insight.detalhe}</p>
                      {/* O py-1 leva a área clicável aos 24px mínimos sem mexer no ritmo do texto. */}
                      {insight.acao && (
                        <Link
                          href={insight.acao.href}
                          className="-mb-1 mt-1 inline-flex items-center gap-1 py-1 text-[12.5px] font-medium text-cedula hover:underline"
                        >
                          {insight.acao.rotulo}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>

      {insights.length > 4 && (
        <div className="px-5 pb-5">
          <Button variant="contorno" size="sm" className="w-full" onClick={() => setExpandido((v) => !v)}>
            {expandido ? 'Mostrar menos' : `Ver os outros ${insights.length - 4}`}
          </Button>
        </div>
      )}
    </Card>
  );
}
