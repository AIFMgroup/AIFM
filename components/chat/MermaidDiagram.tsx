'use client';

import { useEffect, useRef, useState } from 'react';

interface MermaidDiagramProps {
  code: string;
  id?: string;
  className?: string;
}

/** Quick heuristic: does this look like valid mermaid syntax? */
function looksLikeMermaid(code: string): boolean {
  const trimmed = code.trim().split('\n')[0].trim().toLowerCase();
  const validStarts = [
    'graph ', 'graph\n', 'flowchart ', 'flowchart\n',
    'sequencediagram', 'sequence', 'classdiagram', 'class ',
    'statediagram', 'erdiagram', 'gantt', 'pie', 'gitgraph',
    'journey', 'mindmap', 'timeline', 'quadrantchart',
    'sankey', 'xychart', 'block-beta',
  ];
  return validStarts.some(s => trimmed.startsWith(s));
}

export function MermaidDiagram({ code, id, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!code.trim() || !containerRef.current) return;

    // Skip rendering if the content doesn't look like valid mermaid syntax
    if (!looksLikeMermaid(code)) {
      setError('not-mermaid');
      return;
    }

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
          suppressErrorRendering: true,
          logLevel: 5, // fatal only – suppress console noise
        });
        const { svg: out } = await mermaid.render(diagramId, code.trim());
        setSvg(out);
      } catch {
        // Silently fall back to showing raw code – no console spam
        setError('render-failed');
      }
    };

    render();
  }, [code, id]);

  // On error, fall back to a plain code block instead of showing the mermaid error
  if (error) {
    return (
      <div className={`my-3 ${className}`}>
        <pre className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-gray-700">
          {code}
        </pre>
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
