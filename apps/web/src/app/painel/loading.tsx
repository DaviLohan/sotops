import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-10 w-72 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="mt-6 h-56" />
    </div>
  );
}
