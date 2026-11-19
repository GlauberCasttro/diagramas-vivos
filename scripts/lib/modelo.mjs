// Validação do diagram.json (F0). Sem dependências; coleta todos os erros.
export const PAPEIS_NO = ['feliz', 'gate', 'memoria', 'neutro', 'externo'];
export const PAPEIS_ARESTA = ['sequencia', 'feliz', 'retorno', 'falha'];
export const NIVEIS = ['informado', 'proposto'];

const str = (v) => typeof v === 'string' && v.length > 0;
const obj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function validar(d) {
  const erros = [];
  if (!obj(d)) return { ok: false, erros: ['diagrama: objeto esperado'] };

  if (d.versao !== 1) erros.push('versao: deve ser 1');
  if (typeof d.tipo !== 'number') erros.push('tipo: número esperado');
  if (d.gramatica !== 'fluxo') erros.push('gramatica: deve ser "fluxo"');
  if (!str(d.titulo)) erros.push('titulo: texto obrigatório');
  if (d.subtitulo !== undefined && typeof d.subtitulo !== 'string') erros.push('subtitulo: texto esperado');

  const ids = new Set();
  const usar = (id) => {
    if (!str(id)) return;
    if (ids.has(id)) erros.push(`id duplicado: ${id}`);
    ids.add(id);
  };
  const nivel = (item, rot) => {
    if (item.nivel !== undefined && !NIVEIS.includes(item.nivel))
      erros.push(`${rot}.nivel: ${item.nivel} (aceita ${NIVEIS.join('|')})`);
  };
  const lista = (v, nome) => {
    if (Array.isArray(v)) return v;
    erros.push(`${nome}: lista esperada`);
    return [];
  };

  const zonaIds = new Set();
  if (d.zonas !== undefined) {
    lista(d.zonas, 'zonas').forEach((z, i) => {
      if (!obj(z) || !str(z.id)) return erros.push(`zonas[${i}].id: obrigatório`);
      if (!str(z.nome)) erros.push(`zonas[${z.id}].nome: obrigatório`);
      if (zonaIds.has(z.id)) erros.push(`zonas[${z.id}]: id duplicado: ${z.id}`);
      zonaIds.add(z.id);
    });
  }

  const nos = lista(d.nos, 'nos');
  if (Array.isArray(d.nos) && nos.length < 1) erros.push('nos: mínimo 1');
  nos.forEach((n, i) => {
    if (!obj(n) || !str(n.id)) return erros.push(`nos[${i}].id: obrigatório`);
    usar(n.id);
    const r = `nos[${n.id}]`;
    if (!str(n.nome)) erros.push(`${r}.nome: obrigatório`);
    if (!PAPEIS_NO.includes(n.papel)) erros.push(`${r}.papel: ${n.papel} (aceita ${PAPEIS_NO.join('|')})`);
    if (n.zona !== undefined && !zonaIds.has(n.zona)) erros.push(`${r}.zona: ${n.zona}`);
    nivel(n, r);
  });

  const nosIds = new Set(nos.filter(obj).map((n) => n.id));
  // Zona sem nós vira uma caixa vazia com o nome vazando: erro, não desenho.
  const zonasUsadas = new Set(nos.filter(obj).map((n) => n.zona));
  for (const z of zonaIds) if (!zonasUsadas.has(z)) erros.push(`zonas[${z}]: sem nós`);
  const arestas = lista(d.arestas, 'arestas');
  arestas.forEach((a, i) => {
    if (!obj(a) || !str(a.id)) return erros.push(`arestas[${i}].id: obrigatório`);
    usar(a.id);
    const r = `arestas[${a.id}]`;
    if (!nosIds.has(a.de)) erros.push(`${r}.de: ${a.de}`);
    if (!nosIds.has(a.para)) erros.push(`${r}.para: ${a.para}`);
    if (!PAPEIS_ARESTA.includes(a.papel)) erros.push(`${r}.papel: ${a.papel} (aceita ${PAPEIS_ARESTA.join('|')})`);
    nivel(a, r);
  });

  // Zonas, nós e arestas viram nós do mesmo grafo de layout: ids não podem colidir. As zonas ficam fora
  // de `ids` para que passo de flow nunca as referencie.
  for (const z of zonaIds) if (ids.has(z)) erros.push(`id duplicado: ${z}`);

  if (!Array.isArray(d.flows) || d.flows.length < 1) {
    erros.push('flows: mínimo 1');
  } else {
    d.flows.forEach((f, i) => {
      if (!obj(f) || !str(f.id)) return erros.push(`flows[${i}].id: obrigatório`);
      const r = `flows[${f.id}]`;
      if (!str(f.titulo)) erros.push(`${r}.titulo: obrigatório`);
      if (!Array.isArray(f.passos) || f.passos.length < 2) return erros.push(`${r}: mínimo 2 passos`);
      f.passos.forEach((p, j) => {
        if (!obj(p) || !ids.has(p.ref)) erros.push(`${r}.passos[${j}].ref: ${obj(p) ? p.ref : p}`);
        else if (!str(p.nota)) erros.push(`${r}.passos[${j}].nota: obrigatório`);
      });
    });
  }

  return { ok: erros.length === 0, erros };
}
