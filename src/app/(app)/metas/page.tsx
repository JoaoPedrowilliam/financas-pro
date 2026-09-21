'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CheckCircle2, MinusCircle, MoreVertical, Pencil, Plus, PlusCircle, Target, Trash2 } from 'lucide-react';
import { CabecalhoPagina } from '@/components/shared/cabecalho-pagina';
import { Confirmar } from '@/components/shared/confirmar';
import { Valor } from '@/components/shared/valor';
import { CampoValor } from '@/components/shared/campo-valor';
import { CORES_CARTAO } from '@/components/cartoes/dialogs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFinancas } from '@/store/use-financas';
import { useAcao } from '@/lib/acoes';
import { progressoMeta } from '@/lib/financas';
import { dataLonga, moeda } from '@/lib/format';
import { cn, hojeISO, somar } from '@/lib/utils';
import type { Meta } from '@/types';

export default function PaginaMetas() {
  const { metas, removeMeta, aportarNaMeta } = useFinancas();
  const { executar } = useAcao();

  const [dialogAberto, setDialogAberto] = React.useState(false);
  const [editando, setEditando] = React.useState<Meta | null>(null);
  const [aportando, setAportando] = React.useState<Meta | null>(null);
  const [excluindo, setExcluindo] = React.useState<Meta | null>(null);

  const ativas = metas.filter((m) => !m.concluida);
  const concluidas = metas.filter((m) => m.concluida);

  const guardado = somar(metas, (m) => m.valorAtual);
  const objetivo = somar(metas, (m) => m.valorAlvo);
  const aporteNecessario = somar(ativas, (m) => progressoMeta(m).aporteMensal);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Metas"
        descricao="Objetivos com prazo e valor. O sistema calcula quanto você precisa guardar por mês para chegar lá."
        acoes={
          <Button
            onClick={() => {
              setEditando(null);
              setDialogAberto(true);
            }}
          >
            <Plus />
            Nova meta
          </Button>
        }
      />

      {metas.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={Target}
            titulo="Nenhuma meta definida"
            descricao="Uma reserva de emergência, uma viagem, a entrada de um imóvel. Defina o valor e a data, e acompanhe o quanto falta."
            acao={
              <Button
                onClick={() => {
                  setEditando(null);
                  setDialogAberto(true);
                }}
              >
                <Plus />
                Criar primeira meta
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Resumo rotulo="Já guardado" valor={guardado} />
            <Resumo rotulo="Somando todas as metas" valor={objetivo} />
            <Resumo
              rotulo="Aporte mensal necessário"
              valor={aporteNecessario}
              nota={`para ${ativas.length} ${ativas.length === 1 ? 'meta ativa' : 'metas ativas'}`}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...ativas, ...concluidas].map((meta) => {
              const p = progressoMeta(meta);
              return (
                <Card key={meta.id} className={cn('overflow-hidden', meta.concluida && 'opacity-75')}>
                  <div className="h-1.5" style={{ background: meta.cor }} />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-display text-[15px] font-semibold">{meta.nome}</p>
                          {meta.concluida && (
                            <Badge tom="positivo">
                              <CheckCircle2 />
                              concluída
                            </Badge>
                          )}
                          {p.atrasada && !meta.concluida && <Badge tom="critico">prazo vencido</Badge>}
                        </div>
                        {meta.descricao && (
                          <p className="mt-0.5 truncate text-[12px] text-ink-muted">{meta.descricao}</p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="fantasma" size="icone-sm" aria-label={`Ações de ${meta.nome}`}>
                            <MoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setEditando(meta);
                              setDialogAberto(true);
                            }}
                          >
                            <Pencil />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem destrutivo onSelect={() => setExcluindo(meta)}>
                            <Trash2 />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-baseline justify-between">
                        <Valor valor={meta.valorAtual} className="font-display text-[22px] font-semibold" />
                        <span className="cifra text-[13px] font-medium" style={{ color: meta.cor }}>
                          {p.percentual.toFixed(0)}%
                        </span>
                      </div>
                      <Progress valor={p.percentual} cor={meta.cor} className="mt-2.5 h-2.5" rotulo={meta.nome} />
                      <p className="mt-2 text-[12px] text-ink-muted">
                        de {moeda(meta.valorAlvo)} · faltam <Valor valor={p.falta} className="font-medium text-ink" />
                      </p>
                    </div>

                    <div className="mt-4 rounded-control bg-surface-sunken p-3 text-[12px]">
                      <p className="text-ink-muted">
                        Prazo: <span className="text-ink">{dataLonga(meta.prazo)}</span>
                      </p>
                      {!meta.concluida && (
                        <p className="mt-1 text-ink-muted">
                          {p.mesesRestantes > 0 ? (
                            <>
                              Guardando <strong className="cifra text-ink">{moeda(p.aporteMensal)}</strong> por mês
                              você chega no prazo.
                            </>
                          ) : (
                            <>Faltam {moeda(p.falta)} e o prazo já passou. Vale remarcar a data.</>
                          )}
                        </p>
                      )}
                    </div>

                    {!meta.concluida && (
                      <Button
                        variant="contorno"
                        size="sm"
                        className="mt-4 w-full"
                        onClick={() => setAportando(meta)}
                      >
                        <PlusCircle />
                        Registrar aporte
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <DialogMeta aberto={dialogAberto} onAbertoChange={setDialogAberto} meta={editando} />

      <DialogAporte
        meta={aportando}
        onFechar={() => setAportando(null)}
        onAportar={async (valor) => {
          if (!aportando) return;
          const novo = aportando.valorAtual + valor;
          const concluiu = novo >= aportando.valorAlvo;
          const ok = await executar(() => aportarNaMeta(aportando.id, valor), {
            sucesso: concluiu ? `Meta "${aportando.nome}" concluída` : 'Aporte registrado',
            descricao: concluiu ? 'Você chegou lá.' : `Faltam ${moeda(aportando.valorAlvo - novo)}.`,
            aoFalhar: 'O aporte não foi registrado',
          });
          if (ok) setAportando(null);
        }}
      />

      <Confirmar
        aberto={Boolean(excluindo)}
        onAbertoChange={(v) => !v && setExcluindo(null)}
        titulo={`Excluir a meta "${excluindo?.nome ?? ''}"?`}
        descricao="O histórico de aportes dela some junto. Isso não pode ser desfeito."
        rotuloConfirmar="Excluir meta"
        onConfirmar={() => {
          if (excluindo) {
            executar(() => removeMeta(excluindo.id), {
              sucesso: 'Meta excluída',
              aoFalhar: 'Não foi possível excluir a meta',
            });
          }
        }}
      />
    </div>
  );
}

function Resumo({ rotulo, valor, nota }: { rotulo: string; valor: number; nota?: string }) {
  return (
    <div className="painel p-4">
      <p className="text-[12px] text-ink-muted">{rotulo}</p>
      <Valor valor={valor} className="mt-1 block font-display text-[20px] font-semibold" />
      {nota ? <p className="mt-0.5 text-[11.5px] text-ink-faint">{nota}</p> : null}
    </div>
  );
}

function DialogMeta({
  aberto,
  onAbertoChange,
  meta,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  meta?: Meta | null;
}) {
  const { addMeta, updateMeta } = useFinancas();
  const { executando, executar } = useAcao();
  const [form, setForm] = React.useState({
    nome: '',
    descricao: '',
    valorAlvo: 0,
    valorAtual: 0,
    prazo: '',
    cor: CORES_CARTAO[1],
  });
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    if (!aberto) return;
    setErro('');
    setForm(
      meta
        ? {
            nome: meta.nome,
            descricao: meta.descricao ?? '',
            valorAlvo: meta.valorAlvo,
            valorAtual: meta.valorAtual,
            prazo: meta.prazo,
            cor: meta.cor,
          }
        : {
            nome: '',
            descricao: '',
            valorAlvo: 0,
            valorAtual: 0,
            prazo: '',
            cor: CORES_CARTAO[Math.floor(Math.random() * CORES_CARTAO.length)],
          },
    );
  }, [aberto, meta]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.nome.trim()) return setErro('Dê um nome à meta.');
    if (form.valorAlvo <= 0) return setErro('Informe quanto você quer juntar.');
    if (!form.prazo) return setErro('Escolha uma data-alvo.');

    const dados = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || undefined,
      valorAlvo: form.valorAlvo,
      valorAtual: form.valorAtual,
      prazo: form.prazo,
      cor: form.cor,
      icone: 'Target',
      concluida: form.valorAtual >= form.valorAlvo,
    };

    const ok = await executar(
      () => (meta ? updateMeta(meta.id, dados) : addMeta(dados)),
      {
        sucesso: meta ? 'Meta atualizada' : 'Meta criada',
        aoFalhar: 'A meta não foi salva',
      },
    );
    if (ok) onAbertoChange(false);
  };

  const previa =
    form.valorAlvo > 0 && form.prazo
      ? progressoMeta({ valorAtual: form.valorAtual, valorAlvo: form.valorAlvo, prazo: form.prazo })
      : null;

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent largura="max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta ? 'Editar meta' : 'Nova meta'}</DialogTitle>
          <DialogDescription>
            Com o valor e o prazo definidos, o sistema calcula o aporte mensal necessário.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nome-meta">Nome</Label>
            <Input
              id="nome-meta"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Reserva de emergência, viagem…"
              className="mt-1.5"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="desc-meta">Descrição</Label>
            <Textarea
              id="desc-meta"
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="O que essa meta significa para você"
              className="mt-1.5 min-h-[60px]"
            />
          </div>

          <div>
            <Label htmlFor="alvo">Quanto quero juntar</Label>
            <div className="mt-1.5">
              <CampoValor id="alvo" value={form.valorAlvo} onChange={(v) => set('valorAlvo', v)} />
            </div>
          </div>

          <div>
            <Label htmlFor="atual">Quanto já tenho</Label>
            <div className="mt-1.5">
              <CampoValor id="atual" value={form.valorAtual} onChange={(v) => set('valorAtual', v)} />
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="prazo">Data-alvo</Label>
            <Input
              id="prazo"
              type="date"
              min={hojeISO()}
              value={form.prazo}
              onChange={(e) => set('prazo', e.target.value)}
              className="mt-1.5"
            />
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
        </div>

        {previa && previa.mesesRestantes > 0 && (
          <p className="rounded-control bg-surface-sunken p-3 text-[12.5px] text-ink-muted">
            Faltam {moeda(previa.falta)} em {previa.mesesRestantes}{' '}
            {previa.mesesRestantes === 1 ? 'mês' : 'meses'} — cerca de{' '}
            <strong className="cifra text-ink">{moeda(previa.aporteMensal)}</strong> por mês.
          </p>
        )}

        {erro && (
          <p role="alert" className="text-[12px] text-coral">
            {erro}
          </p>
        )}

        <DialogFooter>
          <Button variant="contorno" onClick={() => onAbertoChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{meta ? 'Salvar alterações' : 'Criar meta'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogAporte({
  meta,
  onFechar,
  onAportar,
}: {
  meta: Meta | null;
  onFechar: () => void;
  onAportar: (valor: number) => void;
}) {
  const [valor, setValor] = React.useState(0);
  const [retirada, setRetirada] = React.useState(false);

  React.useEffect(() => {
    if (!meta) return;
    setValor(progressoMeta(meta).aporteMensal);
    setRetirada(false);
  }, [meta]);

  if (!meta) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent largura="max-w-md">
        <DialogHeader>
          <DialogTitle>{retirada ? 'Retirar da meta' : 'Registrar aporte'}</DialogTitle>
          <DialogDescription>
            {meta.nome} — {moeda(meta.valorAtual)} de {moeda(meta.valorAlvo)} guardados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={retirada ? 'contorno' : 'primario'}
            onClick={() => setRetirada(false)}
            className="justify-center"
          >
            <PlusCircle />
            Guardar
          </Button>
          <Button
            variant={retirada ? 'primario' : 'contorno'}
            onClick={() => setRetirada(true)}
            className="justify-center"
          >
            <MinusCircle />
            Retirar
          </Button>
        </div>

        <div>
          <Label htmlFor="aporte">Valor</Label>
          <div className="mt-1.5">
            <CampoValor id="aporte" value={valor} onChange={setValor} />
          </div>
          {valor > 0 && !retirada && (
            <p className="mt-1.5 text-[12px] text-ink-muted">
              {meta.valorAtual + valor >= meta.valorAlvo
                ? 'Este aporte conclui a meta.'
                : `Sobram ${moeda(meta.valorAlvo - meta.valorAtual - valor)} depois deste aporte.`}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="contorno" onClick={onFechar}>
            Cancelar
          </Button>
          <Button disabled={valor <= 0} onClick={() => onAportar(retirada ? -valor : valor)}>
            {retirada ? 'Retirar' : 'Guardar'} {moeda(valor)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
