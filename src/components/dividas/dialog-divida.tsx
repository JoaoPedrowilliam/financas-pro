'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CampoValor } from '@/components/shared/campo-valor';
import { useFinancas } from '@/store/use-financas';
import { useAcao } from '@/lib/acoes';
import { moeda } from '@/lib/format';
import { hojeISO } from '@/lib/utils';
import type { Divida } from '@/types';

const ORGAOS: NonNullable<Divida['orgao']>[] = ['Serasa', 'SPC', 'Boa Vista', 'Cenprot', 'Nenhum'];

interface Rascunho {
  credor: string;
  descricao: string;
  valorOriginal: number;
  saldoAtual: number;
  jurosMes: number;
  temAcordo: boolean;
  valorAcordo: number;
  parcelasRestantes: number;
  valorParcela: number;
  negativado: boolean;
  orgao: NonNullable<Divida['orgao']>;
  vencimentoOriginal: string;
  status: Divida['status'];
}

const VAZIO: Rascunho = {
  credor: '',
  descricao: '',
  valorOriginal: 0,
  saldoAtual: 0,
  jurosMes: 5,
  temAcordo: false,
  valorAcordo: 0,
  parcelasRestantes: 0,
  valorParcela: 0,
  negativado: false,
  orgao: 'Nenhum',
  vencimentoOriginal: '',
  status: 'ativa',
};

export function DialogDivida({
  aberto,
  onAbertoChange,
  divida,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  divida?: Divida | null;
}) {
  const { addDivida, updateDivida } = useFinancas();
  const { executando, executar } = useAcao();
  const [form, setForm] = React.useState<Rascunho>(VAZIO);
  const [erros, setErros] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!aberto) return;
    setErros({});
    if (divida) {
      setForm({
        credor: divida.credor,
        descricao: divida.descricao ?? '',
        valorOriginal: divida.valorOriginal,
        saldoAtual: divida.saldoAtual,
        jurosMes: divida.jurosMes,
        temAcordo: Boolean(divida.valorAcordo),
        valorAcordo: divida.valorAcordo ?? 0,
        parcelasRestantes: divida.parcelasRestantes ?? 0,
        valorParcela: divida.valorParcela ?? 0,
        negativado: divida.negativado,
        orgao: divida.orgao ?? 'Nenhum',
        vencimentoOriginal: divida.vencimentoOriginal ?? '',
        status: divida.status,
      });
    } else {
      setForm(VAZIO);
    }
  }, [aberto, divida]);

  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    const e: Record<string, string> = {};
    if (!form.credor.trim()) e.credor = 'Informe para quem você deve.';
    if (form.saldoAtual <= 0) e.saldoAtual = 'O saldo devedor precisa ser maior que zero.';
    if (form.jurosMes < 0 || form.jurosMes > 100) e.jurosMes = 'Use um percentual entre 0 e 100.';
    if (form.temAcordo && form.valorAcordo <= 0) e.valorAcordo = 'Informe o valor proposto no acordo.';
    if (form.temAcordo && form.valorAcordo > form.saldoAtual) {
      e.valorAcordo = 'O acordo está acima do saldo devedor. Confira o valor.';
    }
    setErros(e);
    if (Object.keys(e).length) return;

    const dados = {
      credor: form.credor.trim(),
      descricao: form.descricao.trim() || undefined,
      valorOriginal: form.valorOriginal || form.saldoAtual,
      saldoAtual: form.saldoAtual,
      jurosMes: form.jurosMes,
      valorAcordo: form.temAcordo ? form.valorAcordo : undefined,
      parcelasRestantes: form.parcelasRestantes || undefined,
      valorParcela: form.valorParcela || undefined,
      negativado: form.negativado,
      orgao: form.orgao,
      vencimentoOriginal: form.vencimentoOriginal || undefined,
      status: form.status,
    };

    const ok = await executar(
      () => (divida ? updateDivida(divida.id, dados) : addDivida({ ...dados, pagamentos: [] })),
      {
        sucesso: divida ? 'Dívida atualizada' : 'Dívida cadastrada',
        descricao: divida
          ? undefined
          : 'Ela já entra no plano de quitação e no cálculo do seu patrimônio.',
        aoFalhar: 'A dívida não foi salva',
      },
    );
    if (ok) onAbertoChange(false);
  };

  const economia = form.temAcordo && form.valorAcordo > 0 ? form.saldoAtual - form.valorAcordo : 0;

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{divida ? 'Editar dívida' : 'Cadastrar dívida'}</DialogTitle>
          <DialogDescription>
            Registre o saldo como está hoje, com juros já incorporados. É esse número que o simulador usa.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="credor" rotulo="Credor" erro={erros.credor}>
            <Input
              id="credor"
              value={form.credor}
              onChange={(e) => set('credor', e.target.value)}
              placeholder="Banco, loja ou financeira"
            />
          </Campo>

          <Campo id="vencimento" rotulo="Vencimento original">
            <Input
              id="vencimento"
              type="date"
              max={hojeISO()}
              value={form.vencimentoOriginal}
              onChange={(e) => set('vencimentoOriginal', e.target.value)}
            />
          </Campo>

          <Campo id="descricao" rotulo="O que era" className="sm:col-span-2">
            <Textarea
              id="descricao"
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="Cheque especial, cartão da loja, empréstimo pessoal…"
              className="min-h-[60px]"
            />
          </Campo>

          <Campo id="original" rotulo="Valor original">
            <CampoValor id="original" value={form.valorOriginal} onChange={(v) => set('valorOriginal', v)} />
          </Campo>

          <Campo id="saldo" rotulo="Saldo devedor hoje" erro={erros.saldoAtual}>
            <CampoValor id="saldo" value={form.saldoAtual} onChange={(v) => set('saldoAtual', v)} />
          </Campo>

          <Campo id="juros" rotulo="Juros ao mês (%)" erro={erros.jurosMes}>
            <Input
              id="juros"
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={form.jurosMes}
              onChange={(e) => set('jurosMes', Number(e.target.value))}
              className="cifra text-right"
            />
            {form.jurosMes > 0 && (
              <p className="mt-1 text-[12px] text-ink-faint">
                Equivale a {((Math.pow(1 + form.jurosMes / 100, 12) - 1) * 100).toFixed(0)}% ao ano.
              </p>
            )}
          </Campo>

          <Campo id="status" rotulo="Situação">
            <Select value={form.status} onValueChange={(v) => set('status', v as Divida['status'])}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Em aberto</SelectItem>
                <SelectItem value="negociando">Em negociação</SelectItem>
                <SelectItem value="quitada">Quitada</SelectItem>
              </SelectContent>
            </Select>
          </Campo>

          <Campo id="parcelas" rotulo="Parcelas restantes">
            <Input
              id="parcelas"
              type="number"
              min={0}
              value={form.parcelasRestantes || ''}
              onChange={(e) => set('parcelasRestantes', Number(e.target.value))}
              placeholder="Deixe vazio se não está parcelada"
              className="cifra text-right"
            />
          </Campo>

          <Campo id="parcela" rotulo="Valor da parcela">
            <CampoValor id="parcela" value={form.valorParcela} onChange={(v) => set('valorParcela', v)} />
          </Campo>
        </div>

        <div className="space-y-3 rounded-control border border-line p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="negativado" className="text-ink">
                Meu nome está negativado por esta dívida
              </Label>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                Usado para contar quantas pendências faltam para limpar seu nome.
              </p>
            </div>
            <Switch
              id="negativado"
              checked={form.negativado}
              onCheckedChange={(v) => set('negativado', v)}
            />
          </div>

          {form.negativado && (
            <div>
              <Label htmlFor="orgao">Órgão</Label>
              <Select value={form.orgao} onValueChange={(v) => set('orgao', v as NonNullable<Divida['orgao']>)}>
                <SelectTrigger id="orgao" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORGAOS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-control border border-line p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="acordo" className="text-ink">
                Tenho uma proposta de acordo
              </Label>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                O simulador passa a calcular sobre o valor negociado, não sobre o saldo cheio.
              </p>
            </div>
            <Switch id="acordo" checked={form.temAcordo} onCheckedChange={(v) => set('temAcordo', v)} />
          </div>

          {form.temAcordo && (
            <div>
              <Label htmlFor="valor-acordo">Valor proposto</Label>
              <div className="mt-1.5">
                <CampoValor
                  id="valor-acordo"
                  value={form.valorAcordo}
                  onChange={(v) => set('valorAcordo', v)}
                />
              </div>
              {erros.valorAcordo ? (
                <p role="alert" className="mt-1 text-[12px] text-coral">
                  {erros.valorAcordo}
                </p>
              ) : economia > 0 ? (
                <p className="mt-1 text-[12px] text-cedula-ink">
                  Desconto de {moeda(economia)} — {((economia / form.saldoAtual) * 100).toFixed(0)}% do saldo.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{divida ? 'Salvar alterações' : 'Cadastrar dívida'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  id,
  rotulo,
  erro,
  className,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="mt-1.5">{children}</div>
      {erro ? (
        <p role="alert" className="mt-1 text-[12px] text-coral">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
