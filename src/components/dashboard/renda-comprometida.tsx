'use client';

import * as React from 'react';
import { Pencil, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CampoValor } from '@/components/shared/campo-valor';
import { Valor } from '@/components/shared/valor';
import { useFinancas } from '@/store/use-financas';
import { useAcao } from '@/lib/acoes';
import type { RendaComprometida, SituacaoRenda } from '@/lib/financas';
import { moeda } from '@/lib/format';

/**
 * Quanto da renda já tem dono.
 *
 * A barra é segmentada por origem do compromisso, não por cor de alerta: ver
 * que metade do comprometimento é dívida muda o que a pessoa faz a respeito —
 * um total de 70% não diz nada sobre onde agir.
 */

const SITUACOES: Record<SituacaoRenda, { rotulo: string; tom: 'positivo' | 'aviso' | 'critico'; texto: string }> = {
  saudavel: {
    rotulo: 'folga no orçamento',
    tom: 'positivo',
    texto: 'Sobra espaço para guardar e para imprevistos.',
  },
  apertada: {
    rotulo: 'orçamento apertado',
    tom: 'aviso',
    texto: 'Dá para fechar o mês, mas sobra pouco para o inesperado.',
  },
  'no-limite': {
    rotulo: 'no limite',
    tom: 'critico',
    texto: 'Quase tudo que entra já tem destino. Um imprevisto vira dívida.',
  },
  estourada: {
    rotulo: 'acima da renda',
    tom: 'critico',
    texto: 'Os compromissos passam do que entra. A diferença sai de reserva ou de crédito.',
  },
};

const FAIXAS = [
  { chave: 'fixas' as const, rotulo: 'Contas fixas', cor: 'hsl(var(--graf-1))' },
  { chave: 'variaveis' as const, rotulo: 'Contas variáveis', cor: 'hsl(var(--graf-3))' },
  { chave: 'assinaturas' as const, rotulo: 'Assinaturas', cor: 'hsl(var(--graf-5))' },
  { chave: 'dividas' as const, rotulo: 'Parcelas de dívida', cor: 'hsl(var(--coral))' },
];

export function PainelRenda({ dados }: { dados: RendaComprometida }) {
  const [editando, setEditando] = React.useState(false);
  const { percentual, situacao, total, livre, renda } = dados;

  if (percentual === null) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Quanto da sua renda já tem dono</CardTitle>
            <CardDescription>
              Informe quanto entra por mês e veja qual fatia já está comprometida com contas fixas,
              assinaturas e parcelas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-control border border-line p-4">
              <p className="text-[13px] text-ink-muted">
                Seus compromissos mensais somam{' '}
                <strong className="cifra font-semibold text-ink">{moeda(total)}</strong>. Falta só
                saber quanto entra para calcular o percentual.
              </p>
              <Button className="mt-3" onClick={() => setEditando(true)}>
                <Wallet />
                Informar minha renda
              </Button>
            </div>
          </CardContent>
        </Card>
        <DialogRenda aberto={editando} onAbertoChange={setEditando} />
      </>
    );
  }

  const info = SITUACOES[situacao];
  // A barra representa a renda inteira. Acima de 100% ela satura e o excedente
  // aparece como número, não como barra maior que o próprio total.
  const escala = Math.max(renda, total, 1);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Quanto da sua renda já tem dono</CardTitle>
              <CardDescription>
                Compromissos recorrentes deste mês sobre a renda de {moeda(renda)}.
              </CardDescription>
            </div>
            <Badge tom={info.tom}>{info.rotulo}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span
                className={`cifra font-display text-[34px] font-semibold tracking-tight ${
                  situacao === 'estourada' || situacao === 'no-limite' ? 'text-coral' : ''
                }`}
              >
                {percentual.toFixed(0)}%
              </span>
              <span className="text-[13px] text-ink-muted">
                <Valor valor={total} className="font-semibold text-ink" /> comprometidos
              </span>
            </div>
            <p className="mt-1 text-[13px] text-ink-muted">{info.texto}</p>
          </div>

          <div>
            <div
              className="flex h-3 w-full overflow-hidden rounded-pill bg-surface-sunken"
              role="img"
              aria-label={FAIXAS.map((f) => `${f.rotulo}: ${moeda(dados[f.chave])}`).join('. ')}
            >
              {FAIXAS.map((f) => {
                const valor = dados[f.chave];
                if (valor <= 0) return null;
                return (
                  <div
                    key={f.chave}
                    style={{ width: `${(valor / escala) * 100}%`, background: f.cor }}
                    className="h-full"
                  />
                );
              })}
            </div>

            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {FAIXAS.map((f) => (
                <li key={f.chave} className="flex items-start gap-2">
                  <span className="mt-1 size-2.5 shrink-0 rounded-[3px]" style={{ background: f.cor }} />
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] text-ink-muted">{f.rotulo}</p>
                    <Valor valor={dados[f.chave]} className="block text-[14px] font-semibold" />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-surface-sunken px-3 py-2.5">
            <p className="text-[13px] text-ink-muted">
              {livre >= 0 ? 'Sobra para gastar e guardar' : 'Falta para cobrir os compromissos'}{' '}
              <Valor
                valor={Math.abs(livre)}
                className={`font-semibold ${livre >= 0 ? 'text-cedula-ink' : 'text-coral'}`}
              />
            </p>
            <Button variant="fantasma" size="sm" onClick={() => setEditando(true)}>
              <Pencil />
              Mudar renda
            </Button>
          </div>

          {dados.linhas.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink">
                Ver os {dados.linhas.length} compromissos
              </summary>
              <ul className="mt-2 space-y-1">
                {dados.linhas.map((l, i) => (
                  <li
                    key={`${l.nome}-${i}`}
                    className="flex items-center gap-2 border-b border-line py-1.5 text-[13px] last:border-0"
                  >
                    <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                    <span className="shrink-0 text-[11px] text-ink-faint">
                      {l.tipo === 'fixa'
                        ? 'fixa'
                        : l.tipo === 'variavel'
                          ? 'variável'
                          : l.tipo === 'assinatura'
                            ? 'assinatura'
                            : 'dívida'}
                    </span>
                    <Valor valor={l.valor} className="w-24 shrink-0 text-right font-medium" />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <DialogRenda aberto={editando} onAbertoChange={setEditando} />
    </>
  );
}

function DialogRenda({
  aberto,
  onAbertoChange,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
}) {
  const { perfil, updatePerfil } = useFinancas();
  const { executando, executar } = useAcao();
  const [valor, setValor] = React.useState(0);

  React.useEffect(() => {
    if (aberto) setValor(perfil.rendaMensal ?? 0);
  }, [aberto, perfil.rendaMensal]);

  const salvar = async () => {
    const ok = await executar(() => updatePerfil({ rendaMensal: valor }), {
      sucesso: 'Renda atualizada',
      aoFalhar: 'Não foi possível salvar a renda',
    });
    if (ok) onAbertoChange(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-md">
        <DialogHeader>
          <DialogTitle>Sua renda mensal</DialogTitle>
          <DialogDescription>
            Informe o valor líquido — o que de fato cai na conta, já com descontos.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="renda">Quanto entra por mês</Label>
          <div className="mt-1.5">
            <CampoValor id="renda" value={valor} onChange={setValor} autoFocus />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            Se a sua renda varia, use a média dos últimos meses. O número serve de régua, não
            precisa ser exato ao centavo.
          </p>
        </div>

        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)} disabled={executando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={executando}>
            {executando ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
