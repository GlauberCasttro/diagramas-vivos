#!/usr/bin/env python3
"""render_check.py - captura o SVG e cada passo do HTML com Chrome headless.

Uso: python3 scripts/render_check.py <NN-slug.html> [--saida <dir>]

Gera (viewport 1600x1000, escala 2): svg-escuro.png, svg-claro.png e, para cada
passo de todos os flows em sequencia (via #passo=N), passo-NN-escuro.png e
passo-NN-claro.png. Pre-requisitos ao lado do HTML: NN-slug.svg e NN-slug.diagram.json
(o numero de passos e a soma de flows[].passos). So biblioteca padrao do Python 3.

Determinismo: --force-prefers-reduced-motion (nada anima), --virtual-time-budget=1500,
perfil novo (--user-data-dir temporario) por captura.

Temas: o HTML guarda o tema em localStorage (diagramas-vivos-tema), que um perfil novo
nao tem; o tema "auto" segue prefers-color-scheme. Por isso o tema vem de
--blink-settings=preferredColorScheme=N: 0 = escuro, 1 = claro (confirmado pelo
fundo das capturas). O SVG avulso e sempre escuro por padrao; para o claro
e capturado uma copia temporaria com data-theme="light" na raiz.
Saida padrao: pasta irma <stem>-capturas/.
"""
import argparse
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

LARGURA, ALTURA, ESCALA = 1600, 1000, 2
ESQUEMA = {"escuro": 0, "claro": 1}
CANDIDATOS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
]


def achar_chrome():
    env = os.environ.get("DIAGRAMAS_VIVOS_CHROME")
    if env:  # se definido, so ele conta
        return env if os.path.exists(env) else None
    for c in CANDIDATOS:
        p = c if os.path.isabs(c) else shutil.which(c)
        if p and os.path.exists(p):
            return p
    return None


def capturar(chrome, url, png, esquema):
    if os.path.exists(png):
        os.remove(png)  # nunca aceitar PNG de execucao anterior
    with tempfile.TemporaryDirectory(prefix="dv-chrome-") as perfil:
        cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
               "--force-prefers-reduced-motion", "--virtual-time-budget=1500",
               f"--blink-settings=preferredColorScheme={esquema}",
               f"--user-data-dir={perfil}", f"--force-device-scale-factor={ESCALA}",
               f"--window-size={LARGURA},{ALTURA}", f"--screenshot={png}", url]
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
        except (subprocess.TimeoutExpired, OSError):
            return False
    return os.path.exists(png) and os.path.getsize(png) > 0


def total_passos(modelo_json):
    with open(modelo_json, encoding="utf-8") as f:
        d = json.load(f)
    return sum(len(fl.get("passos", [])) for fl in d.get("flows", []))


def main():
    ap = argparse.ArgumentParser(description="Captura SVG e passos do HTML em PNG")
    ap.add_argument("html")
    ap.add_argument("--saida")
    a = ap.parse_args()

    chrome = achar_chrome()
    if not chrome:
        env = os.environ.get("DIAGRAMAS_VIVOS_CHROME")
        onde = f"{env} (DIAGRAMAS_VIVOS_CHROME)" if env else ", ".join(CANDIDATOS)
        print("FAIL: Chrome/Chromium nao encontrado. Procurei em: " + onde, file=sys.stderr)
        return 1

    html = os.path.abspath(a.html)
    if not os.path.isfile(html) or not html.endswith(".html"):
        print(f"FAIL: HTML nao encontrado: {a.html}", file=sys.stderr)
        return 1
    stem = html[:-5]
    svg, modelo = stem + ".svg", stem + ".diagram.json"
    for p in (svg, modelo):
        if not os.path.isfile(p):
            print(f"FAIL: arquivo vizinho ausente: {p}", file=sys.stderr)
            return 1
    saida = os.path.abspath(a.saida) if a.saida else stem + "-capturas"
    os.makedirs(saida, exist_ok=True)
    n = total_passos(modelo)

    gerados, falhas = [], []

    def tentar(url, nome, tema):
        png = os.path.join(saida, nome)
        if capturar(chrome, url, png, ESQUEMA[tema]):
            gerados.append(png)
        else:
            falhas.append(png)

    with tempfile.TemporaryDirectory(prefix="dv-svg-") as tmp:
        with open(svg, encoding="utf-8") as f:
            src = f.read()
        claro = os.path.join(tmp, "claro.svg")
        with open(claro, "w", encoding="utf-8") as f:
            f.write(src.replace("<svg ", '<svg data-theme="light" ', 1))
        tentar(pathlib.Path(svg).as_uri(), "svg-escuro.png", "escuro")
        tentar(pathlib.Path(claro).as_uri(), "svg-claro.png", "claro")
        for i in range(1, n + 1):
            for tema in ("escuro", "claro"):
                tentar(f"{pathlib.Path(html).as_uri()}#passo={i}", f"passo-{i:02d}-{tema}.png", tema)

    for p in gerados:
        print(p)
    if falhas:
        for p in falhas:
            print(f"FAIL: captura nao gerada: {p}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
