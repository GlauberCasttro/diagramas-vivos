# Gramática fluxo (F0.1)

Diagrama de processo ou de requisição: componentes em cards, ligações com tipo e resposta, cenários que tocam
no próprio SVG. Formato: `references/modelo.md`.

## Zonas
- Agrupam etapas por fase. Nome no padrão `N · Título — o que acontece aqui` (ex.: "2 · Aprovação — humano
  libera; falha em produção desfaz"). Numere na ordem de leitura.
- Zonas são condicionais: use só quando há camadas ou fases reais, principalmente com `--direcao DOWN`.
  Em fluxos de requisição em `RIGHT`, pule as zonas (veja "Zonas aumentam a largura em RIGHT" abaixo).
  Havendo zonas, 2 a 4 é o confortável; registros/estado fora do pipeline vão numa zona própria, com nós `memoria`.
- Nó sem `zona` é permitido; se o diagrama tem zonas, os nós costumam pertencer a uma.

## Nós
- `nome`: curto (cabe em 2 linhas). `descricao`: uma linha de apoio (cabe em 3 linhas; passou disso, encurte).
- Papéis, com semântica fixa de cor: `feliz` (ator principal/caminho feliz, verde), `gate` (decisão, aprovação,
  falha de enforcement, vermelho), `memoria` (estado, registro, banco, azul), `neutro` (passo comum),
  `externo` (sistema ou pessoa fora do escopo).
- `icone` (`pessoa`, `servico`, `ferramenta`, `banco`, `gate`, `externo`, `fila`, `documento`, `agente`; padrão
  derivado do papel) e `selo` (até 12 caracteres, ex.: "MCP") deixam o card legível de relance.
- `nivel: "proposto"` só para o que o Claude sugeriu e o usuário não confirmou (sai tracejado);
  o que o usuário informou é `informado` (padrão). `inferido` não existe na F0.
- Mantenha cerca de 8 a 20 nós. Acima disso, divida em dois diagramas.

## Arestas
- `de`/`para` apontam para nós. `tipo` (opcional) dá a cor da ligação: `chamada` (padrão), `rpc`, `dados`,
  `evento`, `fila`. A legenda do SVG lista os tipos usados.
- `resposta` (texto de 1 a 40 caracteres) gera a **volta tracejada** na mesma ligação (do `para` ao `de`),
  na cor do tipo, com o texto como rótulo. Não modele a resposta como segunda aresta.
- `papel`: `sequencia` (ordem normal), `feliz` (caminho feliz), `retorno` (volta a etapa anterior ou laço,
  tracejado) e `falha` (ramo que segue adiante em direção ao erro/desfazer). Use `retorno` só para voltar no
  tempo; rollback e alerta são `falha` (com `retorno` o layout os desenha acima do nó de origem).
- `rotulo` curto e só quando a seta precisa dizer a condição ou o verbo ("POST /pedidos", "valida"). Texto que
  não pertence a uma seta vai na `nota` do passo ou na `descricao` do nó.

## Flows (cenários)
- Cada flow é um cenário de requisição; pelo menos 1, com 2+ passos. O **primeiro flow** é o caminho feliz e
  toca primeiro. No SVG, cada cenário vira uma linha de legenda no rodapé ("N. Título: A → B → C") e a bolinha
  percorre as ligações dele em loop.
- Cada passo é `{ref, nota, sentido?}`. Para percorrer uma ligação, o `ref` é a **aresta**: `sentido` ausente
  ou `"ida"` vai de `de` a `para`; `"volta"` percorre a resposta e exige `resposta` na aresta.
- **Passo de nó só no começo e no fim** do cenário (quem origina a requisição, quem recebe o resultado). No
  meio, cada passo é uma aresta, na ordem em que a história acontece, ida e volta incluídas.

## Direção e proporção (`--direcao`)
- Padrão **`RIGHT`**: colunas da esquerda para a direita, cards de 300 px, 120 px entre colunas. É o formato
  compacto da referência (`docs/referencia-visual/02-agente.svg`).
- **Zonas aumentam a largura em RIGHT**: em requisições prefira sem zonas (ícones e tipos já agrupam). Caso real:
  10 nós, 4 zonas = 4804 × 735 (6,5:1); sem zonas = 2464 × 688 (3,6:1); DOWN com zonas = 1032 × 2187. Acima de 3:1:
  primeiro remova zonas, depois encurte a cadeia (hubs com irmãos), só então DOWN. Confira o `viewBox` após gerar.
- Mire numa proporção largura:altura de **1 a 3**. Os exemplos `agente` (1204 × 628) e `requisicao`
  (1846 × 796) ficam nessa faixa. Cadeias muito longas em linha (a partir de ~8 etapas, ou com muitos
  retornos) passam de 5:1 em RIGHT (`fluxo-card` 7235 × 1114): divida em dois diagramas ou
  use `--direcao DOWN` para ler rolando.

## Limites conhecidos
- O layout usa uma direção só para o diagrama inteiro; não dá para ter zonas empilhadas com nós em linha
  dentro de cada uma. Cards de camadas com retorno podem ficar levemente desalinhados da coluna.
