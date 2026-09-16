'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ArrowLeftRight, Paperclip, TrendingDown, TrendingUp, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, SelectVazio,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CampoValor } from '@/components/shared/campo-valor';
import { useFinancas } from '@/store/use-financas';
import { useAcao } from '@/lib/acoes';
import { moeda } from '@/lib/format';
import { cn, hojeISO, uid } from '@/lib/utils';
import type { Anexo, Transacao, TipoTransacao } from '@/types';

const TIPOS: { valor: TipoTransacao; rotulo: string; icone: typeof TrendingUp; classe: string }[] = [
  { valor: 'receita', rotulo: 'Receita', icone: TrendingUp, classe: 'data-[ativo=true]:bg-cedula-soft data-[ativo=true]:text-cedula-ink data-[ativo=true]:border-cedula/40' },
  { valor: 'despesa', rotulo: 'Despesa', icone: TrendingDown, classe: 'data-[ativo=true]:bg-coral-soft data-[ativo=true]:text-coral data-[ativo=true]:border-coral/40' },
  { valor: 'transferencia', rotulo: 'Transferência', icone: ArrowLeftRight, classe: 'data-[ativo=true]:bg-aco-soft data-[ativo=true]:text-aco data-[ativo=true]:border-aco/40' },
];

const LIMITE_ANEXO = 2 * 1024 * 1024; // 2 MB: acima disso o localStorage estoura rápido.

const SEM_CONTA = 'Nenhuma conta cadastrada. Crie uma em Contas → Contas bancárias.';

interface Rascunho {
  tipo: TipoTransacao;
  descricao: string;
  valor: number;
  data: string;
  categoriaId: string;
  contaId: string;
  contaDestinoId: string;
  cartaoId: string;
  pago: boolean;
  observacao: string;
  etiquetas: string[];
  anexos: Anexo[];
  parcelar: boolean;
  parcelas: number;
}

const RASCUNHO_VAZIO: Rascunho = {
  tipo: 'despesa',
  descricao: '',
  valor: 0,
  data: hojeISO(),
  categoriaId: '',
  contaId: '',
  contaDestinoId: '',
  cartaoId: '',
  pago: true,
  observacao: '',
  etiquetas: [],
  anexos: [],
  parcelar: false,
  parcelas: 2,
};

export function DialogTransacao({
  aberto,
  onAbertoChange,
  transacao,
  tipoInicial,
  cartaoInicial,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  /** Quando presente, o diálogo entra em modo de edição. */
  transacao?: Transacao | null;
  tipoInicial?: TipoTransacao;
  /** Pré-seleciona o cartão. Usado pelo atalho "Cartão" do dashboard. */
  cartaoInicial?: string;
}) {
  const { contas, cartoes, categorias, addTransacao, updateTransacao } = useFinancas();
  const { executando, executar } = useAcao();
  const [form, setForm] = React.useState<Rascunho>(RASCUNHO_VAZIO);
  const [novaEtiqueta, setNovaEtiqueta] = React.useState('');
  const [erros, setErros] = React.useState<Record<string, string>>({});

  const editando = Boolean(transacao);

  React.useEffect(() => {
    if (!aberto) return;
    setErros({});
    setNovaEtiqueta('');
    if (transacao) {
      setForm({
        tipo: transacao.tipo,
        descricao: transacao.descricao,
        valor: transacao.valor,
        data: transacao.data,
        categoriaId: transacao.categoriaId ?? '',
        contaId: transacao.contaId ?? '',
        contaDestinoId: transacao.contaDestinoId ?? '',
        cartaoId: transacao.cartaoId ?? '',
        pago: transacao.status === 'pago',
        observacao: transacao.observacao ?? '',
        etiquetas: transacao.etiquetas,
        anexos: transacao.anexos,
        parcelar: false,
        parcelas: 2,
      });
    } else {
      setForm({
        ...RASCUNHO_VAZIO,
        tipo: tipoInicial ?? 'despesa',
        // Conta e cartão são excludentes no formulário: quem vem pelo atalho do
        // cartão não deve chegar com uma conta já marcada.
        cartaoId: cartaoInicial ?? '',
        contaId: cartaoInicial ? '' : contas[0]?.id ?? '',
      });
    }
  }, [aberto, transacao, tipoInicial, cartaoInicial, contas]);

  const categoriasDoTipo = React.useMemo(
    () =>
      categorias.filter(
        (c) => !c.arquivada && c.tipo === (form.tipo === 'receita' ? 'receita' : 'despesa'),
      ),
    [categorias, form.tipo],
  );
  const raizes = categoriasDoTipo.filter((c) => !c.paiId);

  const atualizar = <K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) =>
    setForm((f) => ({ ...f, [chave]: valor }));

  const anexar = async (arquivos: FileList | null) => {
    if (!arquivos) return;
    const novos: Anexo[] = [];
    for (const arquivo of Array.from(arquivos)) {
      if (arquivo.size > LIMITE_ANEXO) {
        toast.error(`"${arquivo.name}" tem mais de 2 MB`, {
          description: 'Comprima o arquivo ou anexe uma versão menor.',
        });
        continue;
      }
      const dados = await new Promise<string>((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(String(leitor.result));
        leitor.onerror = () => reject(leitor.error);
        leitor.readAsDataURL(arquivo);
      });
      novos.push({ id: uid(), nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size, dados });
    }
    if (novos.length) atualizar('anexos', [...form.anexos, ...novos]);
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.descricao.trim()) e.descricao = 'Dê um nome para reconhecer o lançamento depois.';
    if (form.valor <= 0) e.valor = 'O valor precisa ser maior que zero.';
    if (!form.data) e.data = 'Escolha a data.';
    if (form.tipo === 'transferencia') {
      if (!form.contaId) e.contaId = 'Escolha a conta de origem.';
      if (!form.contaDestinoId) e.contaDestinoId = 'Escolha a conta de destino.';
      if (form.contaId && form.contaId === form.contaDestinoId) {
        e.contaDestinoId = 'A origem e o destino não podem ser a mesma conta.';
      }
    } else if (!form.contaId && !form.cartaoId) {
      e.contaId = 'Informe a conta ou o cartão usado.';
    }
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = async () => {
    if (!validar()) return;

    const base = {
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor: form.valor,
      data: form.data,
      categoriaId: form.tipo === 'transferencia' ? null : form.categoriaId || null,
      contaId: form.contaId || null,
      contaDestinoId: form.tipo === 'transferencia' ? form.contaDestinoId || null : null,
      cartaoId: form.tipo === 'transferencia' ? null : form.cartaoId || null,
      status: form.pago ? ('pago' as const) : ('pendente' as const),
      observacao: form.observacao.trim() || undefined,
      etiquetas: form.etiquetas,
      anexos: form.anexos,
    };

    const parcelas = !editando && form.parcelar && form.cartaoId ? form.parcelas : undefined;

    const ok = await executar(
      () =>
        editando && transacao
          ? updateTransacao(transacao.id, base)
          : addTransacao({ ...base, parcelas }),
      {
        sucesso: editando
          ? 'Lançamento atualizado'
          : parcelas
            ? `Compra dividida em ${parcelas}x de ${moeda(form.valor / parcelas)}`
            : 'Lançamento salvo',
        aoFalhar: 'Lançamento não foi salvo',
      },
    );

    // Falhou: o diálogo fica aberto com tudo que foi digitado, para reenviar
    // sem redigitar.
    if (ok) onAbertoChange(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar lançamento' : 'Novo lançamento'}</DialogTitle>
          <DialogDescription>
            {editando
              ? 'As mudanças valem para este lançamento apenas.'
              : 'Registre uma entrada, uma saída ou um movimento entre suas contas.'}
          </DialogDescription>
        </DialogHeader>

        {/* Tipo primeiro: ele muda quais campos fazem sentido abaixo. */}
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de lançamento">
          {TIPOS.map((t) => {
            const Icone = t.icone;
            const ativo = form.tipo === t.valor;
            return (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                data-ativo={ativo}
                onClick={() => atualizar('tipo', t.valor)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-control border border-line px-2 py-3 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken',
                  t.classe,
                )}
              >
                <Icone className="size-[18px]" />
                {t.rotulo}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="descricao" rotulo="Descrição" erro={erros.descricao} className="sm:col-span-2">
            <Input
              id="descricao"
              value={form.descricao}
              onChange={(e) => atualizar('descricao', e.target.value)}
              placeholder={form.tipo === 'receita' ? 'Salário de outubro' : 'Mercado do mês'}
              aria-invalid={Boolean(erros.descricao)}
            />
          </Campo>

          <Campo id="valor" rotulo="Valor" erro={erros.valor}>
            <CampoValor id="valor" value={form.valor} onChange={(v) => atualizar('valor', v)} />
          </Campo>

          <Campo id="data" rotulo="Data" erro={erros.data}>
            <Input
              id="data"
              type="date"
              value={form.data}
              onChange={(e) => atualizar('data', e.target.value)}
            />
          </Campo>

          {form.tipo === 'transferencia' ? (
            <>
              <Campo id="origem" rotulo="Sai de" erro={erros.contaId}>
                <Select value={form.contaId} onValueChange={(v) => atualizar('contaId', v)}>
                  <SelectTrigger id="origem">
                    <SelectValue placeholder="Conta de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.length ? (
                      contas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectVazio>{SEM_CONTA}</SelectVazio>
                    )}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo id="destino" rotulo="Entra em" erro={erros.contaDestinoId}>
                <Select value={form.contaDestinoId} onValueChange={(v) => atualizar('contaDestinoId', v)}>
                  <SelectTrigger id="destino">
                    <SelectValue placeholder="Conta de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.length ? (
                      contas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectVazio>{SEM_CONTA}</SelectVazio>
                    )}
                  </SelectContent>
                </Select>
              </Campo>
            </>
          ) : (
            <>
              <Campo id="categoria" rotulo="Categoria">
                <Select value={form.categoriaId} onValueChange={(v) => atualizar('categoriaId', v)}>
                  <SelectTrigger id="categoria">
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {raizes.length ? (
                      raizes.map((mae) => {
                        const filhas = categoriasDoTipo.filter((c) => c.paiId === mae.id);
                        return (
                          <React.Fragment key={mae.id}>
                            <SelectItem value={mae.id}>
                              <span className="flex items-center gap-2">
                                <span className="size-2 rounded-full" style={{ background: mae.cor }} />
                                {mae.nome}
                              </span>
                            </SelectItem>
                            {filhas.map((f) => (
                              <SelectItem key={f.id} value={f.id} className="pl-10">
                                <span className="text-ink-muted">{f.nome}</span>
                              </SelectItem>
                            ))}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <SelectVazio>
                        Nenhuma categoria de {form.tipo === 'receita' ? 'entrada' : 'saída'} cadastrada.
                        Crie em Configurações → Categorias.
                      </SelectVazio>
                    )}
                  </SelectContent>
                </Select>
              </Campo>

              <Campo id="pagamento" rotulo="Pago com" erro={erros.contaId}>
                <Select
                  value={form.cartaoId ? `cartao:${form.cartaoId}` : form.contaId ? `conta:${form.contaId}` : ''}
                  onValueChange={(v) => {
                    const [tipo, id] = v.split(':');
                    if (tipo === 'cartao') {
                      atualizar('cartaoId', id);
                      atualizar('contaId', '');
                    } else {
                      atualizar('contaId', id);
                      atualizar('cartaoId', '');
                      atualizar('parcelar', false);
                    }
                  }}
                >
                  <SelectTrigger id="pagamento">
                    <SelectValue placeholder="Conta ou cartão" />
                  </SelectTrigger>
                  {/* Cada rótulo precisa do seu SelectGroup: solto dentro do
                      SelectContent, o Radix derruba a aplicação em tempo de execução. */}
                  <SelectContent>
                    {!contas.length && !cartoes.length && (
                      <SelectVazio>
                        Nenhuma conta ou cartão cadastrado. Cadastre em Contas ou Cartões para
                        registrar de onde saiu o dinheiro.
                      </SelectVazio>
                    )}
                    <SelectGroup>
                      {contas.length > 0 && <SelectLabel>Contas</SelectLabel>}
                      {contas.map((c) => (
                        <SelectItem key={c.id} value={`conta:${c.id}`}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {cartoes.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Cartões</SelectLabel>
                        {cartoes.map((c) => (
                          <SelectItem key={c.id} value={`cartao:${c.id}`}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </Campo>
            </>
          )}
        </div>

        {/* Parcelamento só aparece quando faz sentido: compra nova, no cartão. */}
        {form.cartaoId && !editando && (
          <div className="rounded-control border border-line bg-surface-sunken p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="parcelar" className="text-ink">
                  Compra parcelada
                </Label>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  Cria um lançamento por parcela, já nas datas certas.
                </p>
              </div>
              <Switch
                id="parcelar"
                checked={form.parcelar}
                onCheckedChange={(v) => atualizar('parcelar', v)}
              />
            </div>
            {form.parcelar && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Input
                  type="number"
                  min={2}
                  max={48}
                  value={form.parcelas}
                  onChange={(e) => atualizar('parcelas', Math.max(2, Math.min(48, Number(e.target.value))))}
                  className="h-9 w-20"
                  aria-label="Número de parcelas"
                />
                <p className="text-[13px] text-ink-muted">
                  {form.parcelas}x de{' '}
                  <strong className="cifra font-semibold text-ink">
                    {moeda(form.valor / form.parcelas)}
                  </strong>
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-control border border-line p-3">
          <div>
            <Label htmlFor="pago" className="text-ink">
              {form.tipo === 'receita' ? 'Já recebi' : 'Já paguei'}
            </Label>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              Lançamentos pendentes não entram no saldo das contas.
            </p>
          </div>
          <Switch id="pago" checked={form.pago} onCheckedChange={(v) => atualizar('pago', v)} />
        </div>

        <details className="group rounded-control border border-line">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink">
            Observação, etiquetas e anexos
          </summary>
          <div className="space-y-4 border-t border-line p-3">
            <Campo id="observacao" rotulo="Observação">
              <Textarea
                id="observacao"
                value={form.observacao}
                onChange={(e) => atualizar('observacao', e.target.value)}
                placeholder="Detalhes que você vai querer lembrar depois"
                className="min-h-[64px]"
              />
            </Campo>

            <div>
              <Label htmlFor="etiqueta">Etiquetas</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {form.etiquetas.map((et) => (
                  <Badge key={et} tom="info" className="gap-1 pr-1">
                    {et}
                    <button
                      type="button"
                      onClick={() => atualizar('etiquetas', form.etiquetas.filter((x) => x !== et))}
                      aria-label={`Remover etiqueta ${et}`}
                      className="rounded-full p-0.5 hover:bg-aco/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                id="etiqueta"
                value={novaEtiqueta}
                onChange={(e) => setNovaEtiqueta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const valor = novaEtiqueta.trim().toLowerCase();
                  if (valor && !form.etiquetas.includes(valor)) {
                    atualizar('etiquetas', [...form.etiquetas, valor]);
                  }
                  setNovaEtiqueta('');
                }}
                placeholder="Digite e pressione Enter"
                className="mt-2 h-9"
              />
            </div>

            <div>
              <Label htmlFor="anexos">Anexos</Label>
              <p className="mb-2 mt-0.5 text-[12px] text-ink-muted">
                Comprovantes e notas, até 2 MB cada.
              </p>
              <input
                id="anexos"
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => anexar(e.target.files)}
                className="block w-full text-[13px] text-ink-muted file:mr-3 file:rounded-control file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-ink hover:file:bg-line"
              />
              {form.anexos.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {form.anexos.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-control bg-surface-sunken px-2.5 py-1.5 text-[13px]"
                    >
                      <Paperclip className="size-3.5 shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                      <span className="cifra shrink-0 text-[11px] text-ink-faint">
                        {(a.tamanho / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => atualizar('anexos', form.anexos.filter((x) => x.id !== a.id))}
                        aria-label={`Remover ${a.nome}`}
                        className="rounded p-0.5 text-ink-faint hover:text-coral"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </details>

        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={executando}>
            {executando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar lançamento"}
          </Button>
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
