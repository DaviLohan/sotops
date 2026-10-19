import { Compass } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFound() {
  return (
    <main id="conteudo" className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        icon={Compass}
        title="Página não encontrada"
        description="O endereço pode ter sido digitado errado ou a página não existe mais."
        action={
          <Button asChild variant="primary">
            <Link href="/">Voltar ao início</Link>
          </Button>
        }
      />
    </main>
  );
}
