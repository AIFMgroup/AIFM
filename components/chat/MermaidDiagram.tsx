'use client';

import { useEffect, useRef, useState } from 'react';

interface MermaidDiagramProps {
  code: string;
  id?: string;
  className?: string;
}

export function MermaidDiagram({ code, id, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!code.trim() || !containerRef.current) return;
    const diagramId = id || `mermaid-${Math.random().toString(36).slice(2, 9)}`;
    setError(null);
    setSvg(null);

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'loose',
        });
        const { svg: out } = await mermaid.render(diagramId, code.trim());
        setSvg(out);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kunde inte rendera diagram');
      }
    };

    render();
  }, [code, id]);

  if (error) {
    return (
      <div className={`my-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm ${className}`}>
        <p className="font-medium">Diagram kunde inte visas</p>
        <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap">{error}</pre>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs">Visa Mermaid-kod</summary>
          <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap border-t border-amber-200 pt-2 mt-2">{code}</pre>
        </details>
      </div>
    );
  }

  if (svg) {
    return (
      <div
        ref={containerRef}
        className={`my-3 flex justify-center overflow-x-auto ${className}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <div ref={containerRef} className={`my-3 flex items-center justify-center py-6 text-gray-400 text-sm ${className}`}>
      Laddar diagram...
    </div>
  );
}
