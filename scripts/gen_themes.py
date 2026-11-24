"""Turunkan token warna lengkap dari 4 warna inti per tema/mode, cek kontras WCAG,
lalu tulis src/constants/themes.ts.
Jalankan dari root repo: python3 scripts/gen_themes.py src/constants/themes.ts"""
import sys

def rgb(h):
    h = h.lstrip('#'); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
def hexc(c): return '#' + ''.join(f'{max(0, min(255, round(x))):02X}' for x in c)
def mix(a, b, t): return hexc([x + (y - x) * t for x, y in zip(rgb(a), rgb(b))])
def lum(h):
    c = [x / 255 for x in rgb(h)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def cr(a, b):
    x, y = sorted([lum(a), lum(b)], reverse=True); return (x + 0.05) / (y + 0.05)
def toward(c, target, against, need):
    """Geser c ke arah target sampai kontras terhadap semua `against` >= need."""
    for i in range(0, 101):
        cand = mix(c, target, i / 100)
        if all(cr(cand, a) >= need for a in against): return cand
    raise SystemExit(f'tidak ketemu: {c}')

WHITE = '#FFFFFF'

def derive(core, mode, ov):
    base, brand, accent, ink = core['base'], core['brand'], core['accent'], core['text']
    dark = mode == 'dark'
    t = {}
    t['bg'] = t['surface'] = base
    t['card'] = mix(base, ink, 0.06) if dark else WHITE
    t['border'] = mix(base, ink, 0.16 if dark else 0.08)
    t['dashed'] = mix(base, ink, 0.30 if dark else 0.20)
    t['white'] = WHITE
    t['text'] = ink
    surf = [t['bg'], t['card']]
    t['textSecondary'] = toward(mix(ink, base, 0.45), ink, surf, 5.0)
    t['placeholder'] = toward(mix(ink, base, 0.55), ink, surf, 4.5)
    # 30% brand
    t['secondary'] = brand
    t['onSecondary'] = toward(WHITE if not dark else ink, WHITE, [brand], 7.0)
    t['tint'] = mix(base, brand, 0.35) if dark else mix(brand, WHITE, 0.87)
    t['secondaryText'] = brand if all(cr(brand, s) >= 4.5 for s in surf + [t['tint']]) \
        else toward(brand, WHITE if dark else ink, surf + [t['tint']], 4.5)
    t['heading'] = t['secondaryText'] if ov.get('headingBrand') else ink
    t['tabInactive'] = toward(mix(brand, WHITE, 0.55), WHITE, [brand], 4.5)
    # 10% aksen
    t['primary'] = accent
    dark_on = base if dark else ink
    t['onPrimary'] = WHITE if cr(WHITE, accent) >= 4.5 else toward(dark_on, '#000000', [accent], 4.5)
    t['primaryTint'] = mix(base, accent, 0.20) if dark else mix(accent, WHITE, 0.90)
    pt_targets = surf + [t['primaryTint']]
    if ov.get('accentTextUseBrand') and not dark:
        t['primaryText'] = t['secondaryText']
    elif ov.get(f'primaryText_{mode}'):
        t['primaryText'] = ov[f'primaryText_{mode}']
    else:
        t['primaryText'] = accent if all(cr(accent, s) >= 4.5 for s in pt_targets) \
            else toward(accent, WHITE if dark else '#000000', pt_targets, 4.5)
    # Sorotan di atas permukaan brand (tab aktif, CTA hero)
    if cr(accent, brand) >= 3.0:
        t['highlightOnBrand'], t['onHighlight'] = accent, t['onPrimary']
    else:
        t['highlightOnBrand'] = t['card'] if dark else WHITE
        t['onHighlight'] = t['primaryText']
    # Semantik
    sem = ov.get(f'semantic_{mode}') or ({
        'success': '#5FD39A', 'warning': '#F2C46B', 'danger': '#FF8A80'} if dark else {
        'success': '#17744A', 'warning': '#8A5A12', 'danger': '#B42323'})
    for k, v in sem.items():
        tint = mix(base, v, 0.16) if dark else mix(v, WHITE, 0.89)
        t[k + 'Tint'] = tint
        t[k] = v if cr(v, tint) >= 4.5 else toward(v, WHITE if dark else '#000000', [tint, t['card']], 4.5)
    t['dangerBorder'] = mix(base, t['danger'], 0.40) if dark else mix(t['danger'], WHITE, 0.72)
    r, g, b = rgb('#000000' if dark else ink)
    t['overlay'] = f'rgba({r}, {g}, {b}, {0.6 if dark else 0.48})'
    return t

CHECKS = [('text', 'bg'), ('text', 'card'), ('textSecondary', 'bg'), ('textSecondary', 'card'),
          ('placeholder', 'card'), ('onSecondary', 'secondary'), ('secondaryText', 'card'),
          ('secondaryText', 'tint'), ('heading', 'bg'), ('tabInactive', 'secondary'),
          ('onPrimary', 'primary'), ('primaryText', 'bg'), ('primaryText', 'card'),
          ('primaryText', 'primaryTint'), ('onHighlight', 'highlightOnBrand'),
          ('success', 'successTint'), ('warning', 'warningTint'), ('danger', 'dangerTint')]

THEMES = [
    ('tealAmber', 'Teal & Amber', 'Tenang dan fokus, satu warna hangat untuk aksi.',
     {'light': dict(base='#F6F4EF', brand='#0F4C5C', accent='#F2A541', text='#1E2A44'),
      'dark': dict(base='#10171F', brand='#1B3A44', accent='#F2A541', text='#E8E6E1')},
     {'accentTextUseBrand': True}),
    ('mossVermilion', 'Moss & Vermilion', 'Buku catatan lab: kertas, tinta hijau, pena merah.',
     {'light': dict(base='#F4F1EA', brand='#4A5A2B', accent='#C63A22', text='#22201C'),
      'dark': dict(base='#1A1915', brand='#2F3820', accent='#E2583D', text='#EDE9DF')},
     {'semantic_light': {'success': '#1F6B5C', 'warning': '#8A5A12', 'danger': '#9E1B32'},
      'semantic_dark': {'success': '#6FD1BE', 'warning': '#F2C46B', 'danger': '#FF8FA3'}}),
    ('aubergineCitron', 'Aubergine & Citron', 'Berani dan bernuansa studio.',
     {'light': dict(base='#F1EFF4', brand='#3E2A47', accent='#D8E84A', text='#241B29'),
      'dark': dict(base='#18131B', brand='#2E2236', accent='#D8E84A', text='#ECE8F0')},
     {'accentTextUseBrand': True}),
    ('rustCobalt', 'Rust & Cobalt', 'Hangat dan membumi, seperti buku catatan kulit.',
     {'light': dict(base='#EFE9DF', brand='#7A3E22', accent='#2F5BEA', text='#2A1D16'),
      'dark': dict(base='#1A1411', brand='#3A2318', accent='#6E8CF5', text='#EEE7DC')},
     {'headingBrand': True,
      'semantic_light': {'success': '#17744A', 'warning': '#7D6200', 'danger': '#A51D3A'}}),
    ('graphiteCoral', 'Graphite & Coral', 'Modern dan editorial.',
     {'light': dict(base='#F4F4F0', brand='#2E3135', accent='#FF5A7A', text='#1B1C1E'),
      'dark': dict(base='#141517', brand='#25282C', accent='#FF6E8A', text='#EDEDE8')},
     {'primaryText_light': '#C8304F'}),
]

KEYS = ['primary', 'primaryText', 'primaryTint', 'onPrimary', 'secondary', 'secondaryText',
        'onSecondary', 'tint', 'tabInactive', 'highlightOnBrand', 'onHighlight', 'heading',
        'bg', 'card', 'surface', 'border', 'dashed', 'white', 'text', 'textSecondary',
        'placeholder', 'success', 'successTint', 'warning', 'warningTint', 'danger',
        'dangerTint', 'dangerBorder', 'overlay']

out = []
fail = 0
for tid, name, mood, cores, ov in THEMES:
    out.append(f"  {tid}: {{\n    name: '{name}',\n    mood: '{mood}',")
    for mode in ('light', 'dark'):
        t = derive(cores[mode], mode, ov)
        worst = min(cr(t[a], t[b]) for a, b in CHECKS)
        bad = [(a, b, round(cr(t[a], t[b]), 2)) for a, b in CHECKS if cr(t[a], t[b]) < 4.5]
        print(f'{tid:16} {mode:5} min {worst:5.2f}', 'GAGAL ' + str(bad) if bad else 'OK')
        fail += len(bad)
        out.append(f'    {mode}: {{')
        out += [f"      {k}: '{t[k]}'," for k in KEYS]
        out.append('    },')
    out.append('  },')

if fail: sys.exit('ada pasangan gagal, themes.ts tidak ditulis')

ts = """// Daftar tema warna (light + dark) untuk fitur ganti tema.
// File ini DIBUAT oleh scripts/gen_themes.py (jangan diedit manual); nilai turunan (tint, border, teks sekunder, dst.)
// dihitung dari 4 warna inti tiap mode, dan semua pasangan teks/latar sudah dicek
// minimal 4.5:1 (WCAG AA).
//
// Aturan 60-30-10 per tema:
//   60% base   -> bg, surface, card
//   30% brand  -> secondary (tab bar, header, kartu hero)
//   10% accent -> primary (SATU aksi utama per layar, badge, progres, item terpilih)
//   text       -> text (tidak dihitung dalam 60-30-10)
//
// Token yang perlu diperhatikan:
//   onPrimary        teks di atas primary (bisa gelap, mis. amber/citron/coral)
//   primaryText      aksen sebagai teks/ikon di atas latar terang (tautan, centang)
//   secondaryText    brand sebagai teks/ikon di atas latar (di dark mode lebih terang)
//   onSecondary      teks di atas permukaan brand
//   highlightOnBrand latar tab aktif / CTA di atas brand; onHighlight = teksnya

export type ThemeColors = {
""" + ''.join(f'  {k}: string;\n' for k in KEYS) + """};

export type ThemeMode = 'light' | 'dark';

export type ThemeDefinition = {
  name: string;
  mood: string;
  light: ThemeColors;
  dark: ThemeColors;
};

export const THEMES = {
""" + '\n'.join(out) + """
} satisfies Record<string, ThemeDefinition>;

export type ThemeId = keyof typeof THEMES;

// Tema yang dipakai sekarang. Ganti di sini untuk mencoba tema lain.
// Dark mode sudah disimpan, tetapi layar belum membaca mode perangkat:
// style masih statis (StyleSheet.create di level modul).
export const ACTIVE_THEME: ThemeId = 'graphiteCoral';
export const ACTIVE_MODE: ThemeMode = 'light';
"""
open(sys.argv[1], 'w').write(ts)
print('ditulis', sys.argv[1])
