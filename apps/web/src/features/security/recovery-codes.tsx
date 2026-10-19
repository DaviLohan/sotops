'use client';

import { Check, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';

/** Exibe os códigos de recuperação — a única vez em que eles ficam visíveis. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const content = [
      'Federação eFootball 1x1 — códigos de recuperação',
      'Cada código funciona uma única vez. Guarde em local seguro.',
      '',
      ...codes,
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'codigos-de-recuperacao.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <Callout tone="warning" title="Guarde estes códigos agora">
        Eles não serão mostrados de novo. Cada um substitui o aplicativo autenticador uma única vez,
        caso você perca o acesso ao celular.
      </Callout>
      <ul
        aria-label="Códigos de recuperação"
        className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border bg-surface-sunken p-4 font-mono text-sm text-fg"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button size="sm" onClick={download}>
          <Download aria-hidden="true" />
          Baixar .txt
        </Button>
      </div>
    </div>
  );
}
