import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Busca das listas do portal: um formulário GET comum, que funciona até sem JavaScript. */
export function ListSearch({
  label,
  placeholder,
  defaultValue,
}: {
  label: string;
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <form role="search" className="flex max-w-xl gap-2">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
          aria-hidden="true"
        />
        <Input
          type="search"
          name="busca"
          aria-label={label}
          placeholder={placeholder}
          defaultValue={defaultValue}
          maxLength={60}
          className="pl-9"
        />
      </div>
      <Button type="submit">Buscar</Button>
    </form>
  );
}
