# Gramática fluxo (F0)

Diagrama de processo com zonas numeradas, nós em cards e setas direcionais. Formato: `references/modelo.md`.

## Zonas
- Agrupam etapas por fase. Nome no padrão `N · Título — o que acontece aqui` (ex.: "2 · Aprovação — humano
  libera; falha em produção desfaz"). Numere na ordem de leitura.
- 2 a 4 zonas é o confortável. Registros/estado fora do pipeline vão numa zona própria, com nós `memoria`.
- Nó sem `zona` é permitido, mas prefira sempre pertencer a uma.

## Nós
- `nome`: curto (cabe em 2 linhas). `descricao`: uma linha de apoio (cabe em 3 linhas; passou disso, encurte).
- Papéis, com semântica fixa de cor: `feliz` (ator principal/caminho feliz, verde), `gate` (decisão, aprovação,
  falha de enforcement, vermelho), `memoria` (estado, registro, banco, azul), `neutro` (passo comum),
  `externo` (sistema ou pessoa fora do escopo).
- `nivel: "proposto"` só para o que o Claude sugeriu e o usuário não confirmou (sai tracejado com selo);
  o que o usuário informou é `informado` (padrão). `inferido` não existe na F0.
- Mantenha cerca de 8 a 20 nós. Acima disso, divida em dois diagramas.

## Arestas
- `sequencia` (cinza): ordem normal. `feliz` (verde): o caminho feliz. `retorno` (vermelho tracejado): volta
  a etapa anterior ou laço. `falha`: ramo que segue adiante em direção ao erro/desfazer.
- Use `retorno` só para voltar para trás no tempo. Ramo de falha que avança (rollback, alerta) é `falha`: com
  `retorno` o layout o desenha acima do nó de origem.
- `rotulo` curto e só quando a seta precisa dizer a condição ("falhou", "aprovado"). Cada rótulo aumenta o
  espaço entre camadas.
- Não há rótulo solto: texto que não pertence a uma seta vai na `nota` do passo ou na `descricao` do nó.

## Flow
- Pelo menos 1 flow, com 2+ passos. O **primeiro flow** é o caminho feliz: só as arestas dele correm em repouso.
- Cada passo: `ref` (id de nó ou aresta) + `nota` (uma frase, o que acontece e por quê). Percorra nó, aresta,
  nó, na ordem em que a história acontece. Outros flows (ex.: "Caminho de falha") são opcionais.

## Direção (`--direcao`, derivado de `docs/f0-resultado.md`)
- `DOWN` (cima para baixo): padrão recomendado para fluxos longos ou com muitas camadas (cerca de 8 ou mais
  nós em sequência, ou com retornos). Em RIGHT cada etapa vira uma coluna: fluxos longos ficam com
  proporção 5:1 a 6:1 e não cabem na tela nem no zoom do passo a passo; em DOWN ficam 0,5 a 0,8 de largura
  por altura e se leem rolando.
- `RIGHT` (esquerda para direita, padrão do CLI): só para fluxos curtos (até cerca de 5 a 6 nós em linha,
  poucos retornos), que cabem numa tela larga.
- Na dúvida, `DOWN`.

## Limites conhecidos
- O layout usa uma direção só para o diagrama inteiro; não dá para ter zonas empilhadas com nós em linha
  dentro de cada uma. Cards de camadas com retorno podem ficar levemente desalinhados da coluna.
