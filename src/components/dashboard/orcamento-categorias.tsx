'use client';

import * as React from 'react';
import Link from 'next/link';
import { SlidersHorizontal, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { Valor } from '@/components/shared/valor';
import { moeda } from '@/lib/format';
import type { LinhaOrcamento, SituacaoOrcamento } from '@/lib/financas';
import { cn } from '@/lib/utils';

/**
 * Cada situação carrega rótulo próprio, não só cor: a barra vermelha e a verde
 * têm a mesma forma para quem não distingue as duas.
 */
const SITUACOES: Record<SituacaoOrcamento, { cor: string; texto: string; classe: string }> = {
  dentro: { cor: 'hsl(var(--cedula))', texto: 'dentro do orçamento', classe: 'text-cedula-ink' },
  perto: { cor: 'hsl(var(--ambar))', texto: 'perto do limite', classe: 'text-ambar' },
  estourado: { cor: 'hsl(var(--coral))', texto: 'passou do teto', classe: 'text-coral' },
};

export function OrcamentoCategorias({ linhas }: { linhas: LinhaOrcamento[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orçamento por categoria</CardTitle>
        <CardDescription>
          Quanto do teto mensal já foi consumido em cada categoria que você limitou.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <EstadoVazio
            icone={Target}
            titulo="Nenhum teto definido"
            descricao="Defina um limite mensal para as categorias que costumam fugir do controle e acompanhe o consumo aqui, sem precisar somar nada."
            acao={
              <Button asChild variant="contorno" size="sm">
                <Link href="/configuracoes">
                  <SlidersHorizontal />
                  Definir tetos
                </Link>
              </Button>
            }
            className="py-10"
          />
        ) : (
          <ul className="space-y-4">
            {linhas.map((linha) => {
              const s = SITUACOES[linha.situacao];
              return (
                <li key={linha.categoria.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-[13.5px] font-medium">{linha.categoria.nome}</p>
                    <p className="shrink-0 text-[12.5px] text-ink-muted">
                      <Valor valor={linha.gasto} className="font-semibold text-ink" /> de{' '}
                      <Valor valor={linha.teto} />
                    </p>
                  </div>

                  <Progress
                    valor={linha.percentual}
                    cor={s.cor}
                    className="mt-2"
                    rotulo={`Orçamento de ${linha.categoria.nome}`}
                  />

                  <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[11.5px]">
                    <span className={cn('font-medium', s.classe)}>
                      {linha.percentual.toFixed(0)}% · {s.texto}
                    </span>
                    <span className="cifra text-ink-faint">
                      {linha.restante >= 0
                        ? `${moeda(linha.restante)} disponíveis`
                        : `${moeda(Math.abs(linha.restante))} acima`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
