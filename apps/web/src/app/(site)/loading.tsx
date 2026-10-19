import { Skeleton } from '@/components/ui/skeleton';

/** Esqueleto da HOME: mantém a forma das seções (hero, faixa, competição, resultados). */
export default function HomeLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando a página inicial">
      <div className="-mt-16 flex min-h-[max(34rem,82svh)] flex-col justify-center border-b border-border bg-canvas-deep px-4 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl space-y-5">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-16 w-full max-w-2xl" />
          <Skeleton className="h-16 w-full max-w-xl" />
          <Skeleton className="h-12 w-64" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-16 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    </div>
  );
}
