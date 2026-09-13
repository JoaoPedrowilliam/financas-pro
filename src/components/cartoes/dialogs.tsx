'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectVazio } from '@/components/ui/select';
import { CampoValor } from '@/components/shared/campo-valor';
import { SeletorBanco } from '@/components/shared/seletor-banco';
import { useFinancas } from '@/store/use-financas';
import { BANCO_GENERICO, resolverBanco } from '@/lib/bancos';
import { cn } from '@/lib/utils';
import type { Assinatura, Cartao, Periodicidade, TipoCartao } from '@/types';

/**
 * Cores de cartão: tons profundos que funcionam como plástico e mantêm texto
 * branco legível por cima, nos dois temas.
 */
export const CORES_CARTAO = [
  '#111111', '#2A2A2A', '#404040', '#14532D', '#166534',
  '#15803D', '#0F766E', '#7C2D12', '#9F1239', '#312E81',
];

const BANDEIRAS = ['Mastercard', 'Visa', 'Elo', 'American Express', 'Hipercard', 'Outra'];

export function DialogCartao({
  aberto,
  onAbertoChange,
  cartao,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  cartao?: Cartao | null;
}) {
  const { contas, addCartao, updateCartao } = useFinancas();
  const [form, setForm] = React.useState({
    nome: '',
    bandeira: 'Mastercard',
    bancoId: BANCO_GENERICO.id,
    final: '',
    tipo: 'credito' as TipoCartao,
    limite: 0,
    diaFechamento: 28,
    diaVencimento: 5,
    cor: CORES_CARTAO[0],
    contaPagamentoId: '',
  });
  const [erros, setErros] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!aberto) return;
    setErros({});
    setForm(
      cartao
        ? {
            nome: cartao.nome,
            bandeira: cartao.bandeira,
            // Cartão cadastrado antes do catálogo: tentamos reconhecer pelo apelido.
            bancoId: resolverBanco({ bancoId: cartao.bancoId, instituicao: cartao.nome }).id,
            final: cartao.final ?? '',
            tipo: cartao.tipo,
            limite: cartao.limite,
            diaFechamento: cartao.diaFechamento,
            diaVencimento: cartao.diaVencimento,
            cor: cartao.cor,
            contaPagamentoId: cartao.contaPagamentoId ?? '',
          }
        : {
            nome: '',
            bandeira: 'Mastercard',
            bancoId: BANCO_GENERICO.id,
            final: '',
            tipo: 'credito',
            limite: 0,
            diaFechamento: 28,
            diaVencimento: 5,
            cor: CORES_CARTAO[Math.floor(Math.random() * CORES_CARTAO.length)],
            contaPagamentoId: contas[0]?.id ?? '',
          },
    );
  }, [aberto, cartao, contas]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const credito = form.tipo !== 'debito';

  const salvar = () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = 'Dê um apelido ao cartão.';
    if (credito && form.limite <= 0) e.limite = 'Informe o limite para acompanhar o quanto está comprometido.';
    setErros(e);
    if (Object.keys(e).length) return;

    const dados = {
      nome: form.nome.trim(),
      bandeira: form.bandeira,
      bancoId: form.bancoId,
      final: form.final.replace(/\D/g, '').slice(0, 4) || undefined,
      tipo: form.tipo,
      limite: credito ? form.limite : 0,
      diaFechamento: form.diaFechamento,
      diaVencimento: form.diaVencimento,
      cor: form.cor,
      contaPagamentoId: form.contaPagamentoId || null,
    };

    if (cartao) {
      updateCartao(cartao.id, dados);
      toast.success('Cartão atualizado');
    } else {
      addCartao(dados);
      toast.success('Cartão cadastrado');
    }
    onAbertoChange(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-xl">
        <DialogHeader>
          <DialogTitle>{cartao ? 'Editar cartão' : 'Cadastrar cartão'}</DialogTitle>
          <DialogDescription>
            As datas de fechamento e vencimento definem em qual fatura cada compra vai cair.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nome-cartao">Apelido</Label>
            <Input
              id="nome-cartao"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Nubank roxinho, Inter Gold…"
              className="mt-1.5"
            />
            {erros.nome && <p className="mt-1 text-[12px] text-coral">{erros.nome}</p>}
          </div>

          <div>
            <Label htmlFor="banco-cartao">Banco emissor</Label>
            <SeletorBanco
              id="banco-cartao"
              valor={form.bancoId}
              onChange={(v) => set('bancoId', v)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="final-cartao">Últimos 4 dígitos</Label>
            <Input
              id="final-cartao"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={form.final}
              onChange={(e) => set('final', e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4521"
              className="cifra mt-1.5 tracking-[0.2em]"
            />
            <p className="mt-1 text-[11.5px] text-ink-faint">
              Só para reconhecer o cartão. Nunca guarde o número completo aqui.
            </p>
          </div>

          <div>
            <Label htmlFor="tipo-cartao">Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => set('tipo', v as TipoCartao)}>
              <SelectTrigger id="tipo-cartao" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="multiplo">Crédito e débito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="bandeira">Bandeira</Label>
            <Select value={form.bandeira} onValueChange={(v) => set('bandeira', v)}>
              <SelectTrigger id="bandeira" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BANDEIRAS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {credito && (
            <>
              <div>
                <Label htmlFor="limite">Limite</Label>
                <div className="mt-1.5">
                  <CampoValor id="limite" value={form.limite} onChange={(v) => set('limite', v)} />
                </div>
                {erros.limite && <p className="mt-1 text-[12px] text-coral">{erros.limite}</p>}
              </div>

              <div>
                <Label htmlFor="conta-pgto">Fatura debitada em</Label>
                <Select
                  value={form.contaPagamentoId}
                  onValueChange={(v) => set('contaPagamentoId', v)}
                >
                  <SelectTrigger id="conta-pgto" className="mt-1.5">
                    <SelectValue placeholder="Escolher conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.length ? (
                      contas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectVazio>
                        Nenhuma conta cadastrada. Crie uma em Contas → Contas bancárias — o cartão
                        funciona sem isso, mas a fatura não fica vinculada a nenhuma conta.
                      </SelectVazio>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fechamento">Dia do fechamento</Label>
                <Input
                  id="fechamento"
                  type="number"
                  min={1}
                  max={31}
                  value={form.diaFechamento}
                  onChange={(e) => set('diaFechamento', Math.min(31, Math.max(1, Number(e.target.value))))}
                  className="cifra mt-1.5 text-right"
                />
              </div>

              <div>
                <Label htmlFor="vencimento-cartao">Dia do vencimento</Label>
                <Input
                  id="vencimento-cartao"
                  type="number"
                  min={1}
                  max={31}
                  value={form.diaVencimento}
                  onChange={(e) => set('diaVencimento', Math.min(31, Math.max(1, Number(e.target.value))))}
                  className="cifra mt-1.5 text-right"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <Label>Cor</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CORES_CARTAO.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => set('cor', cor)}
                  aria-label={`Cor ${cor}`}
                  aria-pressed={form.cor === cor}
                  className={cn(
                    'size-7 rounded-full transition-transform',
                    form.cor === cor && 'ring-2 ring-ring ring-offset-2 ring-offset-[hsl(var(--surface-raised))]',
                  )}
                  style={{ background: cor }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{cartao ? 'Salvar alterações' : 'Cadastrar cartão'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogAssinatura({
  aberto,
  onAbertoChange,
  assinatura,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  assinatura?: Assinatura | null;
}) {
  const { cartoes, categorias, addAssinatura, updateAssinatura } = useFinancas();
  const categoriasDespesa = React.useMemo(
    () => categorias.filter((c) => c.tipo === 'despesa' && !c.arquivada),
    [categorias],
  );
  const [form, setForm] = React.useState({
    nome: '',
    valor: 0,
    cartaoId: '',
    categoriaId: '',
    diaCobranca: 1,
    periodicidade: 'mensal' as Periodicidade,
    ativa: true,
  });
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    if (!aberto) return;
    setErro('');
    setForm(
      assinatura
        ? {
            nome: assinatura.nome,
            valor: assinatura.valor,
            cartaoId: assinatura.cartaoId ?? '',
            categoriaId: assinatura.categoriaId ?? '',
            diaCobranca: assinatura.diaCobranca,
            periodicidade: assinatura.periodicidade,
            ativa: assinatura.ativa,
          }
        : {
            nome: '',
            valor: 0,
            cartaoId: cartoes[0]?.id ?? '',
            categoriaId: '',
            diaCobranca: 1,
            periodicidade: 'mensal',
            ativa: true,
          },
    );
  }, [aberto, assinatura, cartoes]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = () => {
    if (!form.nome.trim()) return setErro('Dê um nome à assinatura.');
    if (form.valor <= 0) return setErro('Informe o valor cobrado.');

    const dados = {
      nome: form.nome.trim(),
      valor: form.valor,
      cartaoId: form.cartaoId || null,
      categoriaId: form.categoriaId || null,
      diaCobranca: form.diaCobranca,
      periodicidade: form.periodicidade,
      ativa: form.ativa,
    };

    if (assinatura) {
      updateAssinatura(assinatura.id, dados);
      toast.success('Assinatura atualizada');
    } else {
      addAssinatura(dados);
      toast.success('Assinatura cadastrada', {
        description: 'A cobrança será lançada automaticamente todo mês.',
      });
    }
    onAbertoChange(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-lg">
        <DialogHeader>
          <DialogTitle>{assinatura ? 'Editar assinatura' : 'Nova assinatura'}</DialogTitle>
          <DialogDescription>
            Cobranças recorrentes entram sozinhas na fatura do mês, como lançamento pendente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nome-ass">Nome</Label>
            <Input
              id="nome-ass"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Spotify, academia, seguro…"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="valor-ass">Valor</Label>
            <div className="mt-1.5">
              <CampoValor id="valor-ass" value={form.valor} onChange={(v) => set('valor', v)} />
            </div>
          </div>

          <div>
            <Label htmlFor="dia-ass">Dia da cobrança</Label>
            <Input
              id="dia-ass"
              type="number"
              min={1}
              max={31}
              value={form.diaCobranca}
              onChange={(e) => set('diaCobranca', Math.min(31, Math.max(1, Number(e.target.value))))}
              className="cifra mt-1.5 text-right"
            />
          </div>

          <div>
            <Label htmlFor="cartao-ass">Cobrado em</Label>
            <Select value={form.cartaoId} onValueChange={(v) => set('cartaoId', v)}>
              <SelectTrigger id="cartao-ass" className="mt-1.5">
                <SelectValue placeholder="Escolher cartão" />
              </SelectTrigger>
              <SelectContent>
                {cartoes.length ? (
                  cartoes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))
                ) : (
                  <SelectVazio>Nenhum cartão cadastrado. Crie um em &quot;Novo cartão&quot;.</SelectVazio>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="periodicidade-ass">Repete</Label>
            <Select
              value={form.periodicidade}
              onValueChange={(v) => set('periodicidade', v as Periodicidade)}
            >
              <SelectTrigger id="periodicidade-ass" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Todo mês</SelectItem>
                <SelectItem value="bimestral">A cada 2 meses</SelectItem>
                <SelectItem value="trimestral">A cada 3 meses</SelectItem>
                <SelectItem value="semestral">A cada 6 meses</SelectItem>
                <SelectItem value="anual">Uma vez por ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="cat-ass">Categoria</Label>
            <Select value={form.categoriaId} onValueChange={(v) => set('categoriaId', v)}>
              <SelectTrigger id="cat-ass" className="mt-1.5">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasDespesa.length ? (
                  categoriasDespesa.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))
                ) : (
                  <SelectVazio>
                    Nenhuma categoria de saída cadastrada. Crie em Configurações → Categorias.
                  </SelectVazio>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-control border border-line p-3 sm:col-span-2">
            <div>
              <Label htmlFor="ativa-ass" className="text-ink">
                Assinatura ativa
              </Label>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                Desligue para parar de gerar cobranças sem apagar o histórico.
              </p>
            </div>
            <Switch id="ativa-ass" checked={form.ativa} onCheckedChange={(v) => set('ativa', v)} />
          </div>
        </div>

        {erro && (
          <p role="alert" className="text-[12px] text-coral">
            {erro}
          </p>
        )}

        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{assinatura ? 'Salvar alterações' : 'Cadastrar assinatura'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
