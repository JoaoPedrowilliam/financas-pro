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
import {
  Select, SelectContent, SelectItem, SelectLabel, SelectTrigger, SelectValue, SelectVazio,
} from '@/components/ui/select';
import { CampoValor } from '@/components/shared/campo-valor';
import { SeletorBanco } from '@/components/shared/seletor-banco';
import { CORES_CARTAO } from '@/components/cartoes/dialogs';
import { useFinancas } from '@/store/use-financas';
import { useAcao } from '@/lib/acoes';
import { BANCO_GENERICO, bancoPorId, resolverBanco } from '@/lib/bancos';
import { cn, hojeISO } from '@/lib/utils';
import type { Conta, Periodicidade, Recorrencia, TipoConta } from '@/types';

export function DialogConta({
  aberto,
  onAbertoChange,
  conta,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  conta?: Conta | null;
}) {
  const { addConta, updateConta } = useFinancas();
  const { executando, executar } = useAcao();
  const [form, setForm] = React.useState({
    nome: '',
    bancoId: BANCO_GENERICO.id,
    instituicao: '',
    tipo: 'corrente' as TipoConta,
    saldoInicial: 0,
    cor: CORES_CARTAO[3],
    incluirNoPatrimonio: true,
  });
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    if (!aberto) return;
    setErro('');
    setForm(
      conta
        ? {
            nome: conta.nome,
            // Conta antiga não tem `bancoId`: reconhecemos pelo texto que já estava lá.
            bancoId: resolverBanco(conta).id,
            instituicao: conta.instituicao,
            tipo: conta.tipo,
            saldoInicial: conta.saldoInicial,
            cor: conta.cor,
            incluirNoPatrimonio: conta.incluirNoPatrimonio,
          }
        : {
            nome: '',
            bancoId: BANCO_GENERICO.id,
            instituicao: '',
            tipo: 'corrente',
            saldoInicial: 0,
            cor: CORES_CARTAO[Math.floor(Math.random() * CORES_CARTAO.length)],
            incluirNoPatrimonio: true,
          },
    );
  }, [aberto, conta]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const bancoEscolhido = bancoPorId(form.bancoId);
  const outroBanco = !bancoEscolhido || bancoEscolhido.id === BANCO_GENERICO.id;

  const salvar = async () => {
    if (!form.nome.trim()) return setErro('Dê um nome à conta.');
    // `instituicao` segue sendo a fonte legível: com banco do catálogo ela recebe
    // o nome oficial; em "Outro", o que a pessoa digitou.
    const instituicao = outroBanco ? form.instituicao.trim() || '—' : bancoEscolhido.nome;
    const dados = {
      nome: form.nome.trim(),
      bancoId: outroBanco ? BANCO_GENERICO.id : bancoEscolhido.id,
      instituicao,
      tipo: form.tipo,
      saldoInicial: form.saldoInicial,
      cor: form.cor,
      incluirNoPatrimonio: form.incluirNoPatrimonio,
    };
    const ok = await executar(
      () => (conta ? updateConta(conta.id, dados) : addConta(dados)),
      {
        sucesso: conta ? 'Conta atualizada' : 'Conta cadastrada',
        aoFalhar: 'A conta não foi salva',
      },
    );
    if (ok) onAbertoChange(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-lg">
        <DialogHeader>
          <DialogTitle>{conta ? 'Editar conta' : 'Nova conta'}</DialogTitle>
          <DialogDescription>
            O saldo inicial é o ponto de partida: a partir dele, os lançamentos pagos somam e subtraem.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nome-conta">Nome</Label>
            <Input
              id="nome-conta"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Conta corrente, reserva…"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="banco-conta">Banco</Label>
            <SeletorBanco
              id="banco-conta"
              valor={form.bancoId}
              onChange={(v) => set('bancoId', v)}
              className="mt-1.5"
            />
          </div>

          {/* "Outro banco" mantém o campo livre: nenhuma instituição fica de fora. */}
          {outroBanco && (
            <div className="sm:col-span-2">
              <Label htmlFor="instituicao">Nome da instituição</Label>
              <Input
                id="instituicao"
                value={form.instituicao}
                onChange={(e) => set('instituicao', e.target.value)}
                placeholder="Como o banco se chama"
                className="mt-1.5"
              />
              <p className="mt-1 text-[11.5px] text-ink-faint">
                Opcional. Sem preencher, a conta aparece com um ícone de banco neutro.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="tipo-conta">Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => set('tipo', v as TipoConta)}>
              <SelectTrigger id="tipo-conta" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Conta corrente</SelectItem>
                <SelectItem value="digital">Conta digital</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="investimento">Conta de investimento</SelectItem>
                <SelectItem value="carteira">Dinheiro em espécie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="saldo-inicial">Saldo inicial</Label>
            <div className="mt-1.5">
              <CampoValor
                id="saldo-inicial"
                value={form.saldoInicial}
                onChange={(v) => set('saldoInicial', v)}
              />
            </div>
          </div>

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
                    'size-7 rounded-full',
                    form.cor === cor && 'ring-2 ring-ring ring-offset-2 ring-offset-[hsl(var(--surface-raised))]',
                  )}
                  style={{ background: cor }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-control border border-line p-3 sm:col-span-2">
            <div>
              <Label htmlFor="patrimonio" className="text-ink">
                Somar ao patrimônio
              </Label>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                Desligue para contas de terceiros ou de uso compartilhado.
              </p>
            </div>
            <Switch
              id="patrimonio"
              checked={form.incluirNoPatrimonio}
              onCheckedChange={(v) => set('incluirNoPatrimonio', v)}
            />
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
          <Button onClick={salvar}>{conta ? 'Salvar alterações' : 'Criar conta'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogRecorrencia({
  aberto,
  onAbertoChange,
  recorrencia,
  naturezaInicial = 'fixa',
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  recorrencia?: Recorrencia | null;
  naturezaInicial?: Recorrencia['natureza'];
}) {
  const { contas, cartoes, categorias, addRecorrencia, updateRecorrencia } = useFinancas();
  const { executando, executar } = useAcao();
  const [form, setForm] = React.useState({
    nome: '',
    natureza: naturezaInicial,
    tipo: 'despesa' as Recorrencia['tipo'],
    valorPrevisto: 0,
    categoriaId: '',
    contaId: '',
    cartaoId: '',
    diaVencimento: 10,
    periodicidade: 'mensal' as Periodicidade,
    lembreteDias: 3,
    ativa: true,
  });
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    if (!aberto) return;
    setErro('');
    setForm(
      recorrencia
        ? {
            nome: recorrencia.nome,
            natureza: recorrencia.natureza,
            tipo: recorrencia.tipo,
            valorPrevisto: recorrencia.valorPrevisto,
            categoriaId: recorrencia.categoriaId ?? '',
            contaId: recorrencia.contaId ?? '',
            cartaoId: recorrencia.cartaoId ?? '',
            diaVencimento: recorrencia.diaVencimento,
            periodicidade: recorrencia.periodicidade,
            lembreteDias: recorrencia.lembreteDias,
            ativa: recorrencia.ativa,
          }
        : {
            nome: '',
            natureza: naturezaInicial,
            tipo: 'despesa',
            valorPrevisto: 0,
            categoriaId: '',
            contaId: contas[0]?.id ?? '',
            cartaoId: '',
            diaVencimento: 10,
            periodicidade: 'mensal',
            lembreteDias: 3,
            ativa: true,
          },
    );
  }, [aberto, recorrencia, naturezaInicial, contas]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const categoriasDoTipo = React.useMemo(
    () => categorias.filter((c) => c.tipo === form.tipo && !c.arquivada),
    [categorias, form.tipo],
  );

  const salvar = async () => {
    if (!form.nome.trim()) return setErro('Dê um nome à conta recorrente.');
    if (form.valorPrevisto <= 0) return setErro('Informe o valor previsto.');

    const dados = {
      nome: form.nome.trim(),
      natureza: form.natureza,
      tipo: form.tipo,
      valorPrevisto: form.valorPrevisto,
      categoriaId: form.categoriaId || null,
      // Débito em conta e cobrança no cartão são excludentes: o seletor é um só.
      contaId: form.cartaoId ? null : form.contaId || null,
      cartaoId: form.cartaoId || null,
      diaVencimento: form.diaVencimento,
      periodicidade: form.periodicidade,
      inicioEm: recorrencia?.inicioEm ?? hojeISO(),
      lembreteDias: form.lembreteDias,
      ativa: form.ativa,
    };

    const ok = await executar(
      () => (recorrencia ? updateRecorrencia(recorrencia.id, dados) : addRecorrencia(dados)),
      {
        sucesso: recorrencia ? 'Conta recorrente atualizada' : 'Conta recorrente criada',
        descricao: recorrencia ? undefined : 'O lançamento do mês é gerado automaticamente.',
        aoFalhar: 'A conta recorrente não foi salva',
      },
    );
    if (ok) onAbertoChange(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-lg">
        <DialogHeader>
          <DialogTitle>{recorrencia ? 'Editar conta recorrente' : 'Nova conta recorrente'}</DialogTitle>
          <DialogDescription>
            Fixa é a que tem sempre o mesmo valor. Variável oscila — e o sistema passa a acompanhar a
            média para avisar quando fugir da curva.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Natureza da conta">
          {(['fixa', 'variavel'] as const).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={form.natureza === n}
              onClick={() => set('natureza', n)}
              className={cn(
                'rounded-control border border-line px-3 py-2.5 text-[13px] font-medium transition-colors',
                form.natureza === n
                  ? 'border-cedula/40 bg-cedula-soft text-cedula-ink'
                  : 'text-ink-muted hover:bg-surface-sunken',
              )}
            >
              {n === 'fixa' ? 'Valor fixo' : 'Valor variável'}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nome-rec">Nome</Label>
            <Input
              id="nome-rec"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder={form.natureza === 'fixa' ? 'Aluguel, internet…' : 'Luz, água, gás…'}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="valor-rec">
              {form.natureza === 'fixa' ? 'Valor' : 'Valor estimado'}
            </Label>
            <div className="mt-1.5">
              <CampoValor
                id="valor-rec"
                value={form.valorPrevisto}
                onChange={(v) => set('valorPrevisto', v)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="dia-rec">Dia do vencimento</Label>
            <Input
              id="dia-rec"
              type="number"
              min={1}
              max={31}
              value={form.diaVencimento}
              onChange={(e) => set('diaVencimento', Math.min(31, Math.max(1, Number(e.target.value))))}
              className="cifra mt-1.5 text-right"
            />
          </div>

          <div>
            <Label htmlFor="tipo-rec">É entrada ou saída</Label>
            <Select value={form.tipo} onValueChange={(v) => set('tipo', v as Recorrencia['tipo'])}>
              <SelectTrigger id="tipo-rec" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="despesa">Saída</SelectItem>
                <SelectItem value="receita">Entrada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="periodicidade-rec">Repete</Label>
            <Select
              value={form.periodicidade}
              onValueChange={(v) => set('periodicidade', v as Periodicidade)}
            >
              <SelectTrigger id="periodicidade-rec" className="mt-1.5">
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

          <div>
            <Label htmlFor="conta-rec">Debitada em</Label>
            <Select
              value={form.cartaoId ? `cartao:${form.cartaoId}` : form.contaId ? `conta:${form.contaId}` : ''}
              onValueChange={(v) => {
                const [origem, id] = v.split(':');
                if (origem === 'cartao') {
                  set('cartaoId', id);
                  set('contaId', '');
                } else {
                  set('contaId', id);
                  set('cartaoId', '');
                }
              }}
            >
              <SelectTrigger id="conta-rec" className="mt-1.5">
                <SelectValue placeholder="Escolher conta ou cartão" />
              </SelectTrigger>
              <SelectContent>
                {contas.length === 0 && cartoes.length === 0 ? (
                  <SelectVazio>
                    Nenhuma conta cadastrada. Crie uma na aba &quot;Contas bancárias&quot;.
                  </SelectVazio>
                ) : (
                  <>
                    {contas.length > 0 && <SelectLabel>Contas</SelectLabel>}
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={`conta:${c.id}`}>
                        {c.nome}
                      </SelectItem>
                    ))}
                    {cartoes.length > 0 && <SelectLabel>Cartões de crédito</SelectLabel>}
                    {cartoes
                      .filter((c) => !c.arquivado && c.tipo !== 'debito')
                      .map((c) => (
                        <SelectItem key={c.id} value={`cartao:${c.id}`}>
                          {c.nome}
                        </SelectItem>
                      ))}
                  </>
                )}
              </SelectContent>
            </Select>
            {form.cartaoId ? (
              <p className="mt-1 text-[11.5px] text-ink-faint">
                Entra na fatura e compromete o limite do cartão, não o saldo da conta.
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="cat-rec">Categoria</Label>
            <Select value={form.categoriaId} onValueChange={(v) => set('categoriaId', v)}>
              <SelectTrigger id="cat-rec" className="mt-1.5">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasDoTipo.length ? (
                  categoriasDoTipo.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.paiId ? `— ${c.nome}` : c.nome}
                    </SelectItem>
                  ))
                ) : (
                  <SelectVazio>
                    Nenhuma categoria de {form.tipo === 'receita' ? 'entrada' : 'saída'} cadastrada.
                    Crie em Configurações → Categorias.
                  </SelectVazio>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="lembrete">Avisar quantos dias antes</Label>
            <Input
              id="lembrete"
              type="number"
              min={0}
              max={30}
              value={form.lembreteDias}
              onChange={(e) => set('lembreteDias', Math.max(0, Number(e.target.value)))}
              className="cifra mt-1.5 w-24 text-right"
            />
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
          <Button onClick={salvar}>{recorrencia ? 'Salvar alterações' : 'Criar conta recorrente'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
