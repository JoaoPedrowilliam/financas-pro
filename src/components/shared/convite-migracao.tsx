'use client';

import * as React from 'react';
import { ArrowRight, DatabaseBackup, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFinancas } from '@/store/use-financas';
import { useAcao } from '@/lib/acoes';
import {
  contaVazia, jaMigrou, lerDadosLocais, migrarParaSupabase, type DadosLocais,
} from '@/services/migracao';

const CHAVE_ADIADO = 'financas-pro:migracao-adiada';

/**
 * Convite para trazer os dados que ficaram no navegador.
 *
 * Aparece só quando as três condições valem ao mesmo tempo:
 *  · existem dados na chave antiga do localStorage;
 *  · esta conta nunca importou nada (`migracoes_local`);
 *  · a conta está vazia — importar por cima duplicaria tudo, porque os ids do
 *    arquivo local são os mesmos que já estariam no banco.
 *
 * Nada acontece sem a pessoa mandar. E o localStorage não é apagado nem depois
 * de importar: continua sendo a cópia de segurança dela.
 */
export function ConviteMigracao() {
  const [locais, setLocais] = React.useState<DadosLocais | null>(null);
  const [visivel, setVisivel] = React.useState(false);
  const { executando, executar } = useAcao();
  const carregarDoServidor = useFinancas((s) => s.carregarDoServidor);
  const hidratado = useFinancas((s) => s.hidratado);

  React.useEffect(() => {
    if (!hidratado) return;
    let cancelado = false;

    (async () => {
      try {
        if (window.localStorage.getItem(CHAVE_ADIADO) === '1') return;

        const dados = lerDadosLocais();
        if (!dados) return;

        const [migrou, vazia] = await Promise.all([jaMigrou(), contaVazia()]);
        if (migrou || !vazia || cancelado) return;

        setLocais(dados);
        setVisivel(true);
      } catch {
        // Falha ao checar não pode atrapalhar o uso do sistema: o convite
        // simplesmente não aparece, e a importação manual por backup continua
        // disponível em Configurações.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [hidratado]);

  if (!visivel || !locais) return null;

  const migrar = async () => {
    const ok = await executar(
      async () => {
        const resultado = await migrarParaSupabase(locais.estado);
        if (!resultado.ok) {
          throw new Error(
            `Parou em "${resultado.etapa}" depois de ${resultado.registros} registros: ${resultado.erro}`,
          );
        }
        await carregarDoServidor();
      },
      {
        sucesso: 'Dados trazidos para a sua conta',
        descricao: `${locais.registros} registros importados. A cópia no navegador continua intacta.`,
        aoFalhar: 'A importação não foi concluída',
      },
    );
    if (ok) setVisivel(false);
  };

  const adiar = () => {
    try {
      window.localStorage.setItem(CHAVE_ADIADO, '1');
    } catch {
      // Sem armazenamento, o convite volta na próxima visita. Não é problema.
    }
    setVisivel(false);
  };

  return (
    <section className="mb-6 flex flex-col gap-4 rounded-card border border-cedula/35 bg-cedula-soft p-5 sm:flex-row sm:items-center">
      <div className="grid size-10 shrink-0 place-items-center rounded-control bg-cedula text-cedula-fg">
        <DatabaseBackup className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-semibold">
          Encontramos seus dados antigos neste navegador
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          São {locais.registros} registros da versão anterior, que guardava tudo no aparelho. Traga
          para a sua conta e eles passam a acompanhar você em qualquer dispositivo. A cópia local
          não é apagada.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button onClick={migrar} disabled={executando}>
          {executando ? 'Importando…' : 'Trazer meus dados'}
          {!executando && <ArrowRight />}
        </Button>
        <Button variant="fantasma" size="icone" onClick={adiar} aria-label="Agora não" disabled={executando}>
          <X />
        </Button>
      </div>
    </section>
  );
}
