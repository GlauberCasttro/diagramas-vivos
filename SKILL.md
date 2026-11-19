---
name: diagramas-vivos
description: Gera diagramas de engenharia "vivos" (SVG animado com setas que correm + HTML com passo a passo). Use SOMENTE quando o usuário digitar /diagramas-vivos ou pedir explicitamente um diagrama "vivo", "animado", "com flow" ou "com passo a passo". Pedidos genéricos de diagrama, fluxograma ou arquitetura, sem esses termos, NÃO usam esta skill.
---

# diagramas-vivos (gramática fluxo)

O entregável principal é o **SVG vivo**: um único arquivo que **toca sozinho** (uma bolinha percorre cada
ligação, cenário por cenário, em loop, sem JavaScript) e funciona em PR, README e preview do VS Code. Junto
vem o **HTML com passo a passo** (setas `←`/`→` ou `#passo=N`). As **capturas PNG são só verificação** e
vão para uma pasta temporária, nunca para o projeto.

Saída em `docs/diagramas/` do projeto atual: `NN-slug.svg` (vivo), `NN-slug.html` (passo a passo) e
`NN-slug.diagram.json` (modelo, fonte da verdade).

**Caminho dos scripts.** Os scripts ficam em `<diretório desta skill>/scripts/`. Resolva
`<diretório desta skill>` a partir do local deste SKILL.md (normalmente `~/.claude/skills/diagramas-vivos`,
um symlink para o repositório) e use caminho absoluto: a skill pode ser chamada de qualquer projeto. Não
copie scripts para o projeto.

**Pré-requisito.** As dependências dos scripts (elkjs, fontkit, libavoid-js) são instaladas com `npm install`
no `<diretório desta skill>` (uma vez, após clonar ou atualizar). O CLI sempre responde com **um JSON** no
stdout; se a saída não for JSON (ex.: `Cannot find package 'elkjs'`, erro de sintaxe do Node), o **ambiente
está quebrado**, não o modelo: rode `npm install` no diretório da skill (Node recente) e repita. Não mexa
no `diagram.json` por causa disso.

## Escopo

Só existe a gramática **fluxo** (`gramatica: "fluxo"`). Se o pedido for de outro tipo (sequência, ERD, C4,
estados, etc.), diga que esse tipo chega nas fases F1+ e **ofereça um fluxo** equivalente do assunto. Não
improvise outra gramática.

## Como modelar uma requisição (o caso principal)

- **Componentes = nós.** Cada serviço, pessoa, banco, fila ou sistema externo é um nó, com `icone`
  (`pessoa`, `servico`, `ferramenta`, `banco`, `gate`, `externo`, `fila`, `documento`, `agente`; sem ele,
  sai do `papel`) e, se couber, um `selo` curto (até 12 caracteres, ex.: "MCP", "SQL").
- **Ligações = arestas.** `tipo` dá a cor: `chamada` (padrão), `rpc`, `dados`, `evento`, `fila`.
  `resposta` (texto curto) cria a **volta tracejada** na mesma ligação: a bolinha vai pela ida e volta
  pela resposta. Não crie uma segunda aresta para a resposta.
- **Flows = cenários.** Cada flow é uma história de requisição ("Criar pedido", "Falha de pagamento").
  O primeiro flow é o caminho feliz. Cada **passo é uma aresta**: `{ref: <id da aresta>, nota}` é a ida;
  `{ref, sentido: "volta", nota}` é a resposta (a aresta precisa ter `resposta`). Passo de **nó** só no
  começo e no fim do cenário (quem origina, quem recebe o resultado final).
- `papel` do nó dá a cor do card (`feliz`, `gate`, `memoria`, `neutro`, `externo`); `papel` da aresta
  (`feliz`, `sequencia`, `retorno`, `falha`); `nivel: "proposto"` para o que você sugeriu e o usuário não
  confirmou. Referência completa: `<diretório desta skill>/references/modelo.md`; regras de composição:
  `<diretório desta skill>/references/gramaticas/fluxo.md`.
- **Ids** (zonas, nós, arestas, flows) casam `^[A-Za-z0-9_-]+$`: sem espaço, acento, ponto ou `~`.
- `zonas` são opcionais; use só quando há camadas reais (Cliente, Borda, Serviços). Cerca de 8 a 20 nós.

Exemplo completo, pequeno (cabe como `docs/diagramas/fonte/diagram.json`):

```json
{ "versao": 1, "tipo": 1, "gramatica": "fluxo", "titulo": "Criar pedido", "subtitulo": "Do usuário ao banco e de volta",
  "nos": [
    {"id": "usuario", "nome": "Usuário", "descricao": "Faz o pedido pelo app.", "papel": "neutro", "icone": "pessoa"},
    {"id": "gateway", "nome": "API Gateway", "descricao": "Recebe e encaminha a chamada.", "papel": "feliz", "icone": "servico"},
    {"id": "pedidos", "nome": "Serviço de pedidos", "descricao": "Cria o pedido.", "papel": "feliz", "icone": "servico"},
    {"id": "banco", "nome": "Banco de pedidos", "descricao": "Guarda o pedido.", "papel": "memoria", "icone": "banco", "selo": "SQL"}
  ],
  "arestas": [
    {"id": "usuario-gateway", "de": "usuario", "para": "gateway", "papel": "feliz", "tipo": "chamada", "rotulo": "POST /pedidos", "resposta": "201 criado"},
    {"id": "gateway-pedidos", "de": "gateway", "para": "pedidos", "papel": "feliz", "tipo": "rpc", "resposta": "pedido criado"},
    {"id": "pedidos-banco", "de": "pedidos", "para": "banco", "papel": "feliz", "tipo": "dados", "rotulo": "grava", "resposta": "id"}
  ],
  "flows": [{ "id": "criar", "titulo": "Criar pedido", "passos": [
    {"ref": "usuario", "nota": "O usuário envia o pedido."},
    {"ref": "usuario-gateway", "nota": "A chamada chega ao gateway."},
    {"ref": "gateway-pedidos", "nota": "O gateway encaminha ao serviço."},
    {"ref": "pedidos-banco", "nota": "O serviço grava o pedido."},
    {"ref": "pedidos-banco", "sentido": "volta", "nota": "O banco devolve o id."},
    {"ref": "gateway-pedidos", "sentido": "volta", "nota": "O serviço responde ao gateway."},
    {"ref": "usuario-gateway", "sentido": "volta", "nota": "O usuário recebe 201."},
    {"ref": "usuario", "nota": "Fim: pedido confirmado."}
  ] }] }
```

## Direção e proporção

Padrão **`RIGHT`** (colunas da esquerda para a direita, cards de 300 px com 120 px entre colunas): é o
formato compacto da referência visual. Mire numa proporção largura:altura entre **1 e 3** (ex.: 1204×628
e 1846×796 nos exemplos agente e requisição). Passou de 3:1, divida o diagrama em dois ou agrupe nós em
zonas; só use `--direcao DOWN` para uma cadeia longa e estreita (mais de ~6 etapas em linha) ou com muitos
retornos.

## Procedimento

1. **Entender o pedido.** Leia a descrição, conversa ou código indicado. Decida os componentes (nós), as
   ligações (arestas, com `tipo` e `resposta`) e os cenários (flows). Dúvida de objetivo: pergunte antes
   de gerar.
2. **Escrever `diagram.json`** conforme as referências acima, num diretório de trabalho do projeto
   (ex.: `docs/diagramas/fonte/diagram.json`). Todo diagrama tem pelo menos 1 flow com 2+ passos.
3. **Gerar.** Da raiz do projeto, para um diagrama **novo**:
   ```
   node <diretório desta skill>/scripts/gerar.mjs <diagram.json> --saida docs/diagramas
   ```
   **Não calcule o `NN` à mão:** sem `--nome`, o CLI numera sozinho (próximo número livre em
   `docs/diagramas/`, 2 dígitos) e deriva o slug do título; os caminhos escritos vêm em `arquivos` no JSON.
   Para **regerar** um diagrama que já existe, passe o mesmo nome dele: `--nome NN-slug` (sobrescreve).
   Direção padrão `RIGHT` (`--direcao DOWN` só nos casos acima). Roteador padrão: **ELK**
   (`docs/f0-resultado.md`); `--roteador libavoid` só se o ELK falhar. A saída é um JSON no stdout:
   `{arquivos, bytes, violacoes, avisos, roteador, direcao}` (ou `{erro, erros}` no exit 1).
4. **Tratar o código de saída.**
   - `0`: gerado, sem violações. Ainda assim leia `avisos`.
   - `1`: modelo inválido, nada foi escrito. Leia `erros` (citam o id do flow/ref), **corrija o
     `diagram.json`** e repita. Nunca invente nó ou caminho para passar na validação. (Saída que não é JSON
     não é este caso: veja o pré-requisito.)
   - `2`: violação de geometria ou estouro de orçamento (arquivos foram escritos). **Leia `violacoes` e
     `avisos` do JSON antes de ajustar**: cada violação diz o `tipo` (`atravessa-no`, `sobreposicao`,
     `rotulo-colide`, `rotulo-cruzado`, `diagonal`, `orcamento`) e a `aresta`/`alvo`/`arquivo` envolvidos.
     Ajuste o que ela aponta (menos nós por zona, descrições ou rótulos mais curtos, trocar `--direcao`, ou
     `--roteador libavoid`) e repita com o mesmo `--nome`.
5. **Verificar com imagens** (só verificação, nada disso vai para o projeto).
   ```
   python3 <diretório desta skill>/scripts/render_check.py docs/diagramas/NN-slug.html
   ```
   Gera PNGs (SVG, HTML em repouso e cada passo, nos temas escuro e claro) numa **pasta temporária fora do
   projeto** (`<tmp>/diagramas-vivos-capturas/NN-slug/`); os caminhos saem no stdout, e `--saida <dir>`
   escolhe outro lugar. Capturas antigas da pasta são apagadas antes. **Olhe as imagens** (Read): texto
   vazando de card, seta sobre rótulo, nota de passo cobrindo o foco. Problema visível volta ao passo 3.
   A captura `svg-*.png` é só a janela superior esquerda; use as de passo para o detalhe.
   **Se o `render_check.py` sair com código 1** (ex.: `Chrome/Chromium nao encontrado`, captura não gerada),
   a verificação visual **não aconteceu**: nunca trate como aprovado. Na entrega, diga que a verificação
   visual foi pulada e por quê (a mensagem do stderr). Chrome fora do lugar padrão: aponte o executável em
   `DIAGRAMAS_VIVOS_CHROME=/caminho/do/chrome` e rode de novo.
6. **Entregar.** Diga os caminhos: o **`.svg`** é o diagrama vivo, para embutir em PR/README (abre sozinho
   tocando); o **`.html`** é o passo a passo (setas `←`/`→` ou `#passo=N`). Avisos de cobertura de fonte
   (ex.: `→`) são esperados, não são falha.
