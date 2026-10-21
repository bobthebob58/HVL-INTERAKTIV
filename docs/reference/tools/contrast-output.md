## Official palette vs #FFFFFF and #111111

| Name | Group | PMS | CMYK | RGB | HEX (as printed) | HEX from RGB | vs #FFFFFF | vs #111111 | On white | On #111111 |
|---|---|---|---|---|---|---|---|---|---|---|
| Sjøgrønn | Signalfarge | PMS 7710 U | 81/0/23/0 | 0/175/186 | `#00AFBA` | same | 2.68 : 1 | 7.05 : 1 | fails (decorative only) | AAA text |
| Grønn | Signalfarge | PMS 2267 U | 32/0/42/0 | 151/223/154 | `#96DE99` | #97DF9A | 1.59 : 1 | 11.87 : 1 | fails (decorative only) | AAA text |
| Lys blå | Signalfarge | PMS 3105 U | 44/0/11/0 | 100/208/223 | `#64D0DF` | same | 1.81 : 1 | 10.46 : 1 | fails (decorative only) | AAA text |
| Gul | Signalfarge | PMS 114 U | 0/4/87/0 | 249/222/69 | `#F9DE45` | same | 1.35 : 1 | 13.99 : 1 | fails (decorative only) | AAA text |
| Oransje | Signalfarge | PMS 7416 U | 0/72/70/0 | 235/104/82 | `#EB6851` | #EB6852 | 3.17 : 1 | 5.96 : 1 | large text / non-text only | AA text |
| Mørk blå 1 | Støttefarge | PMS 7704 U | 93/4/8/24 | 0/138/175 | `#008AAF` | same | 4.00 : 1 | 4.72 : 1 | large text / non-text only | AA text |
| Mørk blågrønn | Støttefarge | PMS 3285 U | 98/0/59/0 | 0/148/130 | `#009382` | #009482 | 3.82 : 1 | 4.94 : 1 | large text / non-text only | AA text |
| Mørk blå 2 | Støttefarge | PMS 3035 U | 100/30/19/76 | 0/67/87 | `#004357` | same | 10.82 : 1 | 1.74 : 1 | AAA text | fails (decorative only) |
| Mørk rød | Støttefarge | PMS 7421 U | 18/100/45/67 | 109/36/57 | `#6D2439` | same | 10.71 : 1 | 1.76 : 1 | AAA text | fails (decorative only) |
| Hvit | Tilleggstone | — | 0/0/0/0 | 255/255/255 | `#FFFFFF` | same | 1.00 : 1 | 18.88 : 1 | fails (decorative only) | AAA text |
| Grå mørk | Tilleggstone | PMS 2332 U | 50/42/44/6 | 143/138/131 | `#8F8A83` | same | 3.43 : 1 | 5.51 : 1 | large text / non-text only | AA text |
| Grå medium | Tilleggstone | PMS 2331 U | 32/26/29/3 | 176/172/165 | `#B0ACA5` | same | 2.26 : 1 | 8.35 : 1 | fails (decorative only) | AAA text |
| Grå lys | Tilleggstone | PMS 434 U | 5/6/8/10 | 210/205/200 | `#D2CDC8` | same | 1.58 : 1 | 11.97 : 1 | fails (decorative only) | AAA text |
| Blågrå mørk | Tilleggstone | PMS 444 U | 45/16/25/50 | 112/124/124 | `#707B7B` | #707C7C | 4.37 : 1 | 4.32 : 1 | large text / non-text only | large text / non-text only |
| Blågrå medium | Tilleggstone | PMS 442 U | 25/7/19/20 | 172/183/178 | `#ACB7B2` | same | 2.06 : 1 | 9.15 : 1 | fails (decorative only) | AAA text |
| Blågrå lys | Tilleggstone | PMS 5455 U | 17/4/6/4 | 201/213/218 | `#C9D5DA` | same | 1.50 : 1 | 12.60 : 1 | fails (decorative only) | AAA text |

## RGB-vs-HEX discrepancy check (contrast vs white)

- #96DE99: 1.590 : 1 ; #97DF9A: 1.575 : 1
- #009382: 3.821 : 1 ; #009482: 3.778 : 1
- #707B7B: 4.368 : 1 ; #707C7C: 4.318 : 1

## Spec 03 tokens and other values (for comparison)

| Value | Source | vs #FFFFFF | vs #111111 | vs #F4F6F7 |
|---|---|---|---|---|
| `#003D4C` | spec 03 --hvl-primary-dark | 11.85 : 1 | 1.59 : 1 | 10.93 : 1 |
| `#005F6B` | spec 03 --hvl-primary-accent | 7.37 : 1 | 2.56 : 1 | 6.80 : 1 |
| `#007681` | spec 03 --hvl-primary-accent-light | 5.37 : 1 | 3.51 : 1 | 4.96 : 1 |
| `#F4F6F7` | spec 03 --hvl-surface-warm | 1.08 : 1 | 17.42 : 1 | 1.00 : 1 |
| `#111111` | spec 03 --hvl-ink | 18.88 : 1 | 1.00 : 1 | 17.42 : 1 |
| `#4A5560` | spec 03 --hvl-ink-muted | 7.61 : 1 | 2.48 : 1 | 7.02 : 1 |
| `#FF9E1B` | plan orange (D-007) | 2.07 : 1 | 9.13 : 1 | 1.91 : 1 |
| `#00B6C9` | logo SVG symbol fill seen in some third-party SVGs | 2.46 : 1 | 7.67 : 1 | 2.27 : 1 |
| `#003146` | logo SVG wordmark fill seen in one third-party SVG | 13.75 : 1 | 1.37 : 1 | 12.68 : 1 |

## Candidate pairings for proposed tokens

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| `#004357` | `#FFFFFF` | 10.82 : 1 | AAA text |
| `#004357` | `#F4F6F7` | 9.98 : 1 | AAA text |
| `#004357` | `#C9D5DA` | 7.22 : 1 | AAA text |
| `#004357` | `#D2CDC8` | 6.86 : 1 | AA text |
| `#FFFFFF` | `#004357` | 10.82 : 1 | AAA text |
| `#00AFBA` | `#004357` | 4.04 : 1 | large text / non-text only |
| `#64D0DF` | `#004357` | 5.99 : 1 | AA text |
| `#96DE99` | `#004357` | 6.81 : 1 | AA text |
| `#F9DE45` | `#004357` | 8.02 : 1 | AAA text |
| `#008AAF` | `#FFFFFF` | 4.00 : 1 | large text / non-text only |
| `#009382` | `#FFFFFF` | 3.82 : 1 | large text / non-text only |
| `#6D2439` | `#FFFFFF` | 10.71 : 1 | AAA text |
| `#707B7B` | `#FFFFFF` | 4.37 : 1 | large text / non-text only |
| `#111111` | `#00AFBA` | 7.05 : 1 | AAA text |
| `#004357` | `#00AFBA` | 4.04 : 1 | large text / non-text only |
| `#111111` | `#F9DE45` | 13.99 : 1 | AAA text |
| `#004357` | `#F9DE45` | 8.02 : 1 | AAA text |
| `#111111` | `#EB6851` | 5.96 : 1 | AA text |
| `#FFFFFF` | `#6D2439` | 10.71 : 1 | AAA text |
| `#00AFBA` | `#FFFFFF` | 2.68 : 1 | fails (decorative only) |
| `#EB6851` | `#FFFFFF` | 3.17 : 1 | large text / non-text only |
| `#111111` | `#C9D5DA` | 12.60 : 1 | AAA text |
| `#111111` | `#D2CDC8` | 11.97 : 1 | AAA text |
