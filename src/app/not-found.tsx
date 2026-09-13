import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NaoEncontrado() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-cifra-lg font-semibold tracking-tight text-cedula">404</p>
        <h1 className="mt-2 font-display text-xl font-semibold">Essa página não existe</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          O endereço pode ter mudado ou o link está incompleto. O dashboard continua onde você deixou.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
