// Medição e quebra de texto com as fontes reais (Inter e JetBrains Mono) via fontkit.
import * as fontkit from 'fontkit';
import { join } from 'node:path';

export const ESTILO = {
  nome: { familia: 'sans', peso: 600, tamanho: 15 },
  descricao: { familia: 'sans', peso: 400, tamanho: 13 },
  rotulo: { familia: 'sans', peso: 500, tamanho: 12 },
  titulo: { familia: 'sans', peso: 700, tamanho: 22 },
  zona: { familia: 'sans', peso: 600, tamanho: 14 },
};

export async function carregarFontes(dirFontes) {
  return {
    sans: fontkit.openSync(join(dirFontes, 'inter-latin-wght-normal.woff2')),
    mono: fontkit.openSync(join(dirFontes, 'jetbrains-mono-latin-wght-normal.woff2')),
    _cache: new Map(),
  };
}

// fontkit 2.0.4 não consegue decodificar glifos compostos de woff2 variável via getVariation
// (e getVariation reabre o buffer como TTF). Então o layout (glifos + kerning) vem da fonte
// base e a variação de peso entra pelo delta de avanço da tabela HVAR.
function variante(fontes, familia, peso) {
  const base = fontes[familia];
  if (!base) throw new Error(`familia desconhecida: ${familia}`);
  const k = `${familia}:${peso}`;
  if (!fontes._cache.has(k)) {
    const eixo = base.variationAxes && base.variationAxes.wght;
    let proc = null;
    if (eixo) {
      const w = Math.min(eixo.max, Math.max(eixo.min, peso));
      const v = Object.create(base);
      v.variationCoords = base.fvar.axis.map((a) => (a.axisTag.trim() === 'wght' ? w : a.defaultValue));
      // base.layout() memoiza _variationProcessor=null na instância; chama o getter da classe
      // diretamente para criar o processador desta variante.
      if (!base.HVAR) {
        throw new Error(`fonte "${familia}" tem eixo wght mas não tem tabela HVAR: medição por peso indisponível`);
      }
      let proto = Object.getPrototypeOf(base);
      while (proto && !Object.getOwnPropertyDescriptor(proto, '_variationProcessor')) proto = Object.getPrototypeOf(proto);
      const getter = proto && Object.getOwnPropertyDescriptor(proto, '_variationProcessor').get;
      if (!getter) {
        throw new Error('fontkit: _variationProcessor não encontrado; texto.mjs foi escrito para fontkit 2.0.4 (versão pinada). Revise a medição por peso ao atualizar.');
      }
      Object.defineProperty(v, '_variationProcessor', { value: undefined, writable: true, configurable: true });
      proc = getter.call(v);
    }
    fontes._cache.set(k, { base, proc });
  }
  return fontes._cache.get(k);
}

export function medir(fontes, texto, estilo) {
  if (!texto) return 0;
  const { base, proc } = variante(fontes, estilo.familia, estilo.peso);
  const run = base.layout(texto);
  let total = 0;
  run.glyphs.forEach((g, i) => {
    total += run.positions[i].xAdvance;
    if (proc && base.HVAR) total += proc.getAdvanceAdjustment(g.id, base.HVAR);
  });
  return (total * estilo.tamanho) / base.unitsPerEm;
}

export function quebrar(fontes, texto, estilo, larguraMax, maxLinhas) {
  const m = (t) => medir(fontes, t, estilo);
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  let i = 0;
  for (; i < palavras.length; i++) {
    const tent = atual ? `${atual} ${palavras[i]}` : palavras[i];
    if (m(tent) <= larguraMax || !atual) {
      atual = tent;
    } else {
      if (linhas.length === maxLinhas - 1) break; // última linha: corta
      linhas.push(atual);
      atual = palavras[i];
    }
  }
  const cortou = i < palavras.length;
  if (!cortou) {
    linhas.push(atual);
  } else {
    // última linha: junta o resto e corta com reticências até caber
    let resto = [atual, ...palavras.slice(i)].filter(Boolean).join(' ');
    let s = resto;
    while (s.length > 0 && m(`${s}…`) > larguraMax) s = s.slice(0, -1);
    linhas.push(`${s.trimEnd()}…`);
  }
  // linha única que não cabe (palavra gigante): corta com reticências
  return linhas.map((l, idx) => {
    if (m(l) <= larguraMax) return l;
    let s = l.replace(/…$/, '');
    while (s.length > 0 && m(`${s}…`) > larguraMax) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  });
}

export function cobertura(fontes, textos) {
  const f = fontes.sans;
  const faltam = new Set();
  for (const t of textos) {
    for (const ch of t) {
      if (/\s/.test(ch)) continue;
      if (!f.hasGlyphForCodePoint(ch.codePointAt(0))) faltam.add(ch);
    }
  }
  return [...faltam];
}
