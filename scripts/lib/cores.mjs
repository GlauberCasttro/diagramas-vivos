// Portions derived from floorplan (MIT) (c) 2026 Hayden Smith
// Cores (espelhadas em assets/tokens.css como --p-*, --t-* e --i-*) e razão de contraste WCAG 2.x.
// O tema claro é o padrão (referência visual docs/referencia-visual/02-agente.svg); o escuro segue os
// tokens do floorplan.
// - PAPEIS: papéis do nó (o gate dá a cor vermelha do card); >= 4.5:1 sobre o fundo.
// - TIPOS: cor da aresta pelo tipo de ligação (traço, portas e rótulo); texto do rótulo na cor do tipo
//   sobre o fundo, por isso >= 4.5:1. Claro: chamada/rpc da referência; dados escurecido para AA.
// - ICONES_COR: ladrilho e traço do ícone do card (gráfico): >= 3:1 sobre o card (SUPERFICIE).

export const PAPEIS = {
  escuro: { fundo: '#0f0f0f', feliz: '#6fd7a8', gate: '#f28b8b', memoria: '#7aa7ff', neutro: '#b4b4b4', externo: '#e3a6f0' },
  claro: { fundo: '#f3f3f1', feliz: '#157a3a', gate: '#b83d3d', memoria: '#1f5fd6', neutro: '#595959', externo: '#9440ad' },
};

export const SUPERFICIE = { escuro: '#191919', claro: '#ffffff' };

export const TIPOS = {
  claro: { chamada: '#6a45d6', rpc: '#4450cf', dados: '#0a7766', evento: '#a65200', fila: '#a3366f' },
  escuro: { chamada: '#b09cff', rpc: '#99a3ff', dados: '#4fd1b5', evento: '#f2a65e', fila: '#f28cc2' },
};

export const ICONES_COR = {
  claro: {
    pessoa: '#1f7ac4', servico: '#7a5ad8', ferramenta: '#c06a1d', banco: '#0f8a76', gate: '#b83d3d',
    externo: '#6b6b6b', fila: '#9a5b00', documento: '#4a6a8f', agente: '#c43c86',
  },
  escuro: {
    pessoa: '#6db4f2', servico: '#b09cff', ferramenta: '#f0a868', banco: '#4fd1b5', gate: '#f28b8b',
    externo: '#b4b4b4', fila: '#e8b25c', documento: '#9fb6d4', agente: '#f28cc2',
  },
};

function rgb(cor) {
  let h = String(cor).trim().replace(/^#/, '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`cor inválida: ${cor}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function luminancia(cor) {
  const [r, g, b] = rgb(cor).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(corA, corB) {
  const a = luminancia(corA);
  const b = luminancia(corB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
