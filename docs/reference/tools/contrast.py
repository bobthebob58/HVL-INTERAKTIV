"""WCAG 2.x contrast calculator (relative luminance per WCAG 2.2 definition).
Usage: python3 -I contrast.py  -> prints markdown tables to stdout."""

def lin(c8):
    c = c8 / 255.0
    # WCAG 2.x uses 0.03928 threshold (sRGB spec value 0.04045 gives identical results for 8-bit input)
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(hexv):
    h = hexv.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def verdict(r):
    if r >= 7: return "AAA text"
    if r >= 4.5: return "AA text"
    if r >= 3: return "large text / non-text only"
    return "fails (decorative only)"

OFFICIAL = [
    # (Norwegian name, group, PMS, CMYK, RGB, HEX as printed)
    ("Sjøgrønn", "Signalfarge", "PMS 7710 U", "81/0/23/0", "0/175/186", "#00AFBA"),
    ("Grønn", "Signalfarge", "PMS 2267 U", "32/0/42/0", "151/223/154", "#96DE99"),
    ("Lys blå", "Signalfarge", "PMS 3105 U", "44/0/11/0", "100/208/223", "#64D0DF"),
    ("Gul", "Signalfarge", "PMS 114 U", "0/4/87/0", "249/222/69", "#F9DE45"),
    ("Oransje", "Signalfarge", "PMS 7416 U", "0/72/70/0", "235/104/82", "#EB6851"),
    ("Mørk blå 1", "Støttefarge", "PMS 7704 U", "93/4/8/24", "0/138/175", "#008AAF"),
    ("Mørk blågrønn", "Støttefarge", "PMS 3285 U", "98/0/59/0", "0/148/130", "#009382"),
    ("Mørk blå 2", "Støttefarge", "PMS 3035 U", "100/30/19/76", "0/67/87", "#004357"),
    ("Mørk rød", "Støttefarge", "PMS 7421 U", "18/100/45/67", "109/36/57", "#6D2439"),
    ("Hvit", "Tilleggstone", "—", "0/0/0/0", "255/255/255", "#FFFFFF"),
    ("Grå mørk", "Tilleggstone", "PMS 2332 U", "50/42/44/6", "143/138/131", "#8F8A83"),
    ("Grå medium", "Tilleggstone", "PMS 2331 U", "32/26/29/3", "176/172/165", "#B0ACA5"),
    ("Grå lys", "Tilleggstone", "PMS 434 U", "5/6/8/10", "210/205/200", "#D2CDC8"),
    ("Blågrå mørk", "Tilleggstone", "PMS 444 U", "45/16/25/50", "112/124/124", "#707B7B"),
    ("Blågrå medium", "Tilleggstone", "PMS 442 U", "25/7/19/20", "172/183/178", "#ACB7B2"),
    ("Blågrå lys", "Tilleggstone", "PMS 5455 U", "17/4/6/4", "201/213/218", "#C9D5DA"),
]

print("## Official palette vs #FFFFFF and #111111\n")
print("| Name | Group | PMS | CMYK | RGB | HEX (as printed) | HEX from RGB | vs #FFFFFF | vs #111111 | On white | On #111111 |")
print("|---|---|---|---|---|---|---|---|---|---|---|")
for n, g, p, cmyk, rgb, hx in OFFICIAL:
    r, gg, b = (int(x) for x in rgb.split('/'))
    hx2 = "#%02X%02X%02X" % (r, gg, b)
    note = hx2 if hx2 != hx.upper() else "same"
    w, k = ratio(hx, "#FFFFFF"), ratio(hx, "#111111")
    print(f"| {n} | {g} | {p} | {cmyk} | {rgb} | `{hx}` | {note} | {w:.2f} : 1 | {k:.2f} : 1 | {verdict(w)} | {verdict(k)} |")

print("\n## RGB-vs-HEX discrepancy check (contrast vs white)\n")
for a, b in [("#96DE99", "#97DF9A"), ("#009382", "#009482"), ("#707B7B", "#707C7C")]:
    print(f"- {a}: {ratio(a,'#FFFFFF'):.3f} : 1 ; {b}: {ratio(b,'#FFFFFF'):.3f} : 1")

print("\n## Spec 03 tokens and other values (for comparison)\n")
print("| Value | Source | vs #FFFFFF | vs #111111 | vs #F4F6F7 |")
print("|---|---|---|---|---|")
for hx, src in [("#003D4C", "spec 03 --hvl-primary-dark"), ("#005F6B", "spec 03 --hvl-primary-accent"),
                ("#007681", "spec 03 --hvl-primary-accent-light"), ("#F4F6F7", "spec 03 --hvl-surface-warm"),
                ("#111111", "spec 03 --hvl-ink"), ("#4A5560", "spec 03 --hvl-ink-muted"),
                ("#FF9E1B", "plan orange (D-007)"),
                ("#00B6C9", "logo SVG symbol fill seen in some third-party SVGs"),
                ("#003146", "logo SVG wordmark fill seen in one third-party SVG")]:
    print(f"| `{hx}` | {src} | {ratio(hx,'#FFFFFF'):.2f} : 1 | {ratio(hx,'#111111'):.2f} : 1 | {ratio(hx,'#F4F6F7'):.2f} : 1 |")

print("\n## Candidate pairings for proposed tokens\n")
print("| Foreground | Background | Ratio | Verdict |")
print("|---|---|---|---|")
pairs = [
    ("#004357", "#FFFFFF"), ("#004357", "#F4F6F7"), ("#004357", "#C9D5DA"), ("#004357", "#D2CDC8"),
    ("#FFFFFF", "#004357"), ("#00AFBA", "#004357"), ("#64D0DF", "#004357"), ("#96DE99", "#004357"), ("#F9DE45", "#004357"),
    ("#008AAF", "#FFFFFF"), ("#009382", "#FFFFFF"), ("#6D2439", "#FFFFFF"), ("#707B7B", "#FFFFFF"),
    ("#111111", "#00AFBA"), ("#004357", "#00AFBA"), ("#111111", "#F9DE45"), ("#004357", "#F9DE45"),
    ("#111111", "#EB6851"), ("#FFFFFF", "#6D2439"), ("#00AFBA", "#FFFFFF"), ("#EB6851", "#FFFFFF"),
    ("#111111", "#C9D5DA"), ("#111111", "#D2CDC8"),
]
for f, b in pairs:
    r = ratio(f, b)
    print(f"| `{f}` | `{b}` | {r:.2f} : 1 | {verdict(r)} |")
