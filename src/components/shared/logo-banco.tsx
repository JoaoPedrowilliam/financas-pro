'use client';

import * as React from 'react';
import { Landmark } from 'lucide-react';
import { BANCO_GENERICO, resolverBanco, type Banco } from '@/lib/bancos';
import { cn } from '@/lib/utils';

const TAMANHOS = {
  sm: { caixa: 'size-7 rounded-[8px]', icone: 'size-3.5' },
  md: { caixa: 'size-10 rounded-[11px]', icone: 'size-[18px]' },
  lg: { caixa: 'size-12 rounded-[13px]', icone: 'size-6' },
} as const;

/**
 * Tamanho da fonte dentro de um quadrado de 100 unidades, por número de letras.
 * Cada marca ocupa mais ou menos a mesma largura óptica — "nu" e "CAIXA" saem
 * com o mesmo peso visual, que é o que faz uma grade de ícones parecer uma
 * família em vez de um amontoado.
 */
function corpoDaMarca(sigla: string): number {
  const n = [...sigla].length;
  if (n <= 1) return 52;
  if (n === 2) return 44;
  if (n === 3) return 33;
  if (n === 4) return 26;
  if (n === 5) return 21;
  return 18;
}

/**
 * Marca da instituição: a assinatura curta da marca sobre a cor institucional.
 *
 * É SVG e não texto em HTML porque o desenho precisa escalar junto com o
 * quadrado — o mesmo componente aparece a 28px numa lista e a 48px num card,
 * e a proporção entre letra e fundo tem que se manter.
 *
 * Instituição não catalogada cai no ícone de banco neutro: nunca sobra um
 * quadrado vazio, e nada aqui depende de uma imagem externa carregar.
 */
export function LogoBanco({
  banco,
  registro,
  tamanho = 'md',
  className,
}: {
  /** Passe o banco já resolvido… */
  banco?: Banco;
  /** …ou a conta/cartão, e o componente resolve (inclusive por texto livre antigo). */
  registro?: { bancoId?: string | null; instituicao?: string | null };
  tamanho?: keyof typeof TAMANHOS;
  className?: string;
}) {
  const alvo = banco ?? (registro ? resolverBanco(registro) : BANCO_GENERICO);
  const t = TAMANHOS[tamanho];
  const generico = alvo.id === BANCO_GENERICO.id || !alvo.sigla;

  return (
    <span
      role="img"
      aria-label={alvo.nome}
      title={alvo.nome}
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden',
        // O anel interno separa marcas escuras (BTG, XP, C6) de um card escuro.
        'ring-1 ring-inset ring-black/10 dark:ring-white/12',
        t.caixa,
        className,
      )}
      style={{ background: alvo.cor }}
    >
      {generico ? (
        <Landmark className={t.icone} strokeWidth={2.1} style={{ color: alvo.corTexto }} aria-hidden />
      ) : (
        <svg viewBox="0 0 100 100" className="size-full" aria-hidden focusable="false">
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={corpoDaMarca(alvo.sigla)}
            fontWeight="700"
            letterSpacing="-1.5"
            fill={alvo.corTexto}
            fontFamily="var(--font-display), ui-sans-serif, system-ui, sans-serif"
          >
            {alvo.sigla}
          </text>
        </svg>
      )}
    </span>
  );
}
