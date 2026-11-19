// Cores dos papéis (espelhadas em assets/tokens.css como --p-*) e razão de contraste WCAG 2.x.
// Escuro: tokens do floorplan. Claro: escolhidos para >= 4.5:1 sobre o --bg claro do floorplan
// (feliz = --recent claro, memoria = --k-http claro, neutro = --text-3 claro; gate e externo escurecidos).

export const PAPEIS = {
  escuro: { fundo: '#0f0f0f', feliz: '#6fd7a8', gate: '#f28b8b', memoria: '#7aa7ff', neutro: '#b4b4b4', externo: '#e3a6f0' },
  claro: { fundo: '#f3f3f1', feliz: '#157a3a', gate: '#b83d3d', memoria: '#1f5fd6', neutro: '#595959', externo: '#9440ad' },
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
