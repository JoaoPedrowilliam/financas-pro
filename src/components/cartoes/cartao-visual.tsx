'use client';

import * as React from 'react';
import { Valor } from '@/components/shared/valor';
import { LogoBanco } from '@/components/shared/logo-banco';
import { Progress } from '@/components/ui/progress';
import { nomeInstituicao } from '@/lib/bancos';
import { moeda } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Cartao } from '@/types';

/**
 * Marca da bandeira. Formas simples e texto — reconhecível no canto do cartão
 * sem carregar imagem nenhuma.
 */
function MarcaBandeira({ bandeira }: { bandeira: string }) {
  const b = bandeira.toLowerCase();

  if (b.includes('master')) {
    return (
      <svg viewBox="0 0 40 24" className="h-5 w-8" aria-label="Mastercard" role="img">
        <circle cx="15" cy="12" r="9" fill="#FFFFFF" fillOpacity="0.9" />
        <circle cx="25" cy="12" r="9" fill="#FFFFFF" fillOpacity="0.55" />
      </svg>
    );
  }

  const texto = b.includes('visa')
    ? 'VISA'
    : b.includes('elo')
      ? 'elo'
      : b.includes('express') || b.includes('amex')
        ? 'AMEX'
        : b.includes('hiper')
          ? 'hiper'
          : bandeira;

  return (
    <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-white/80" aria-label={bandeira}>
      {texto}
    </span>
  );
}

/**
 * Cartão de crédito como objeto: proporção de cartão real, número mascarado e o
 * limite disponível como número principal — é o que se quer saber antes de gastar.
 * A barra de uso e as datas ficam fora do plástico, onde a tipografia do sistema
 * garante contraste em qualquer tema.
 */
export function CartaoVisual({
  cartao,
  usado,
  className,
  acoes,
}: {
  cartao: Cartao;
  /** Limite comprometido, calculado por `limiteUsado`. */
  usado: number;
  className?: string;
  acoes?: React.ReactNode;
}) {
  const limite = Math.max(0, cartao.limite);
  const disponivel = Math.max(0, limite - usado);
  const pct = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0;
  const apertado = pct > 85;
  const atencao = pct > 65 && !apertado;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        className="relative overflow-hidden rounded-[14px] p-4 text-white shadow-raised sm:p-5"
        style={{ background: `linear-gradient(135deg, ${cartao.cor} 0%, #0A0A0A 165%)` }}
      >
        {/* Brilho diagonal discreto: dá volume ao plástico sem virar decoração. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-white/10 blur-2xl"
        />

        <div className="relative flex items-start gap-3">
          <LogoBanco registro={{ bancoId: cartao.bancoId, instituicao: cartao.nome }} tamanho="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight">
              {nomeInstituicao({ bancoId: cartao.bancoId, instituicao: cartao.nome })}
            </p>
            <p className="truncate text-[11.5px] text-white/65">{cartao.nome}</p>
          </div>
          <MarcaBandeira bandeira={cartao.bandeira} />
          {acoes}
        </div>

        <p className="relative mt-6 cifra text-[15px] font-medium tracking-[0.18em] text-white/85">
          {cartao.final ? `•••• •••• •••• ${cartao.final}` : '•••• •••• •••• ••••'}
        </p>

        <div className="relative mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.07em] text-white/60">Limite disponível</p>
            <Valor
              valor={disponivel}
              className="mt-0.5 block font-display text-[22px] font-semibold leading-none"
            />
          </div>
          <div className="shrink-0 text-right text-[11px] leading-tight text-white/60">
            <p>fecha dia {cartao.diaFechamento}</p>
            <p>vence dia {cartao.diaVencimento}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
          <span className="text-ink-muted">
            Utilizado
            {/* Estado não fica só na cor: quem não distingue verde de vermelho lê o rótulo. */}
            {apertado ? ' · limite quase no fim' : atencao ? ' · atenção' : ''}
          </span>
          <span className="cifra text-ink-muted">
            {moeda(usado, { compacto: true })} de {moeda(limite, { compacto: true })}
          </span>
        </div>
        <Progress
          valor={pct}
          cor={apertado ? 'hsl(var(--coral))' : atencao ? 'hsl(var(--ambar))' : 'hsl(var(--cedula))'}
          className="mt-1.5"
          rotulo={`Limite usado do ${cartao.nome}`}
        />
      </div>
    </div>
  );
}
