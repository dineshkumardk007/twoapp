"""
Writes src/styles/night.css: the night-time version of every fixed colour the
screens use.

Most of the app takes its colours from the Aurora variables (index.css), so it
follows night and day by itself. About a thousand class names do not: pale
tints chosen for a light page - bg-amber-50, text-rose-800, border-stone-200 -
which would sit on the night sky as bright patches with dark, unreadable
text. This finds every one of them in src/ and gives each a night version:
pale fills become a glow of the same hue, dark text becomes light, hairlines
become faint lines of light.

Day is left exactly as designed. Anything inside an element marked
`no-remap` is left alone too - the screens that were drawn dark on purpose
(the nightstand clock, the co-presence room) already know what they are.

Run after adding colours to a screen:   python scripts/gen-night-css.py
"""
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src')
OUT = os.path.join(ROOT, 'styles', 'night.css')

# Tailwind 3.4's palette, the stops used here.
P = {
    'slate':   {50:'f8fafc',100:'f1f5f9',200:'e2e8f0',300:'cbd5e1',400:'94a3b8',500:'64748b',600:'475569',700:'334155',800:'1e293b',900:'0f172a',950:'020617'},
    'gray':    {50:'f9fafb',100:'f3f4f6',200:'e5e7eb',300:'d1d5db',400:'9ca3af',500:'6b7280',600:'4b5563',700:'374151',800:'1f2937',900:'111827',950:'030712'},
    'zinc':    {50:'fafafa',100:'f4f4f5',200:'e4e4e7',300:'d4d4d8',400:'a1a1aa',500:'71717a',600:'52525b',700:'3f3f46',800:'27272a',900:'18181b',950:'09090b'},
    'neutral': {50:'fafafa',100:'f5f5f5',200:'e5e5e5',300:'d4d4d4',400:'a3a3a3',500:'737373',600:'525252',700:'404040',800:'262626',900:'171717',950:'0a0a0a'},
    'stone':   {50:'fafaf9',100:'f5f5f4',200:'e7e5e4',300:'d6d3d1',400:'a8a29e',500:'78716c',600:'57534e',700:'44403c',800:'292524',900:'1c1917',950:'0c0a09'},
    'red':     {50:'fef2f2',100:'fee2e2',200:'fecaca',300:'fca5a5',400:'f87171',500:'ef4444',600:'dc2626',700:'b91c1c',800:'991b1b',900:'7f1d1d',950:'450a0a'},
    'orange':  {50:'fff7ed',100:'ffedd5',200:'fed7aa',300:'fdba74',400:'fb923c',500:'f97316',600:'ea580c',700:'c2410c',800:'9a3412',900:'7c2d12',950:'431407'},
    'amber':   {50:'fffbeb',100:'fef3c7',200:'fde68a',300:'fcd34d',400:'fbbf24',500:'f59e0b',600:'d97706',700:'b45309',800:'92400e',900:'78350f',950:'451a03'},
    'yellow':  {50:'fefce8',100:'fef9c3',200:'fef08a',300:'fde047',400:'facc15',500:'eab308',600:'ca8a04',700:'a16207',800:'854d0e',900:'713f12',950:'422006'},
    'lime':    {50:'f7fee7',100:'ecfccb',200:'d9f99d',300:'bef264',400:'a3e635',500:'84cc16',600:'65a30d',700:'4d7c0f',800:'3f6212',900:'365314',950:'1a2e05'},
    'green':   {50:'f0fdf4',100:'dcfce7',200:'bbf7d0',300:'86efac',400:'4ade80',500:'22c55e',600:'16a34a',700:'15803d',800:'166534',900:'14532d',950:'052e16'},
    'emerald': {50:'ecfdf5',100:'d1fae5',200:'a7f3d0',300:'6ee7b7',400:'34d399',500:'10b981',600:'059669',700:'047857',800:'065f46',900:'064e3b',950:'022c22'},
    'teal':    {50:'f0fdfa',100:'ccfbf1',200:'99f6e4',300:'5eead4',400:'2dd4bf',500:'14b8a6',600:'0d9488',700:'0f766e',800:'115e59',900:'134e4a',950:'042f2e'},
    'cyan':    {50:'ecfeff',100:'cffafe',200:'a5f3fc',300:'67e8f9',400:'22d3ee',500:'06b6d4',600:'0891b2',700:'0e7490',800:'155e75',900:'164e63',950:'083344'},
    'sky':     {50:'f0f9ff',100:'e0f2fe',200:'bae6fd',300:'7dd3fc',400:'38bdf8',500:'0ea5e9',600:'0284c7',700:'0369a1',800:'075985',900:'0c4a6e',950:'082f49'},
    'blue':    {50:'eff6ff',100:'dbeafe',200:'bfdbfe',300:'93c5fd',400:'60a5fa',500:'3b82f6',600:'2563eb',700:'1d4ed8',800:'1e40af',900:'1e3a8a',950:'172554'},
    'indigo':  {50:'eef2ff',100:'e0e7ff',200:'c7d2fe',300:'a5b4fc',400:'818cf8',500:'6366f1',600:'4f46e5',700:'4338ca',800:'3730a3',900:'312e81',950:'1e1b4b'},
    'violet':  {50:'f5f3ff',100:'ede9fe',200:'ddd6fe',300:'c4b5fd',400:'a78bfa',500:'8b5cf6',600:'7c3aed',700:'6d28d9',800:'5b21b6',900:'4c1d95',950:'2e1065'},
    'purple':  {50:'faf5ff',100:'f3e8ff',200:'e9d5ff',300:'d8b4fe',400:'c084fc',500:'a855f7',600:'9333ea',700:'7e22ce',800:'6b21a8',900:'581c87',950:'3b0764'},
    'fuchsia': {50:'fdf4ff',100:'fae8ff',200:'f5d0fe',300:'f0abfc',400:'e879f9',500:'d946ef',600:'c026d3',700:'a21caf',800:'86198f',900:'701a75',950:'4a044e'},
    'pink':    {50:'fdf2f8',100:'fce7f3',200:'fbcfe8',300:'f9a8d4',400:'f472b6',500:'ec4899',600:'db2777',700:'be185d',800:'9d174d',900:'831843',950:'500724'},
    'rose':    {50:'fff1f2',100:'ffe4e6',200:'fecdd3',300:'fda4af',400:'fb7185',500:'f43f5e',600:'e11d48',700:'be123c',800:'9f1239',900:'881337',950:'4c0519'},
}
NEUTRAL = {'slate', 'gray', 'zinc', 'neutral', 'stone'}

def rgb(hexstr):
    return tuple(int(hexstr[i:i + 2], 16) for i in (0, 2, 4))

def rgba(hue, stop, alpha):
    r, g, b = rgb(P[hue][stop])
    return f'rgb({r} {g} {b} / {round(alpha, 3)})'

# Fills: a pale tint by day is a glow of its hue at night.
FILL_ALPHA = {50: 0.10, 100: 0.14, 200: 0.20, 300: 0.30}
NEUTRAL_FILL_ALPHA = {50: 0.035, 100: 0.055, 200: 0.085, 300: 0.13}
# Lines.
BORDER_ALPHA = {50: 0.14, 100: 0.18, 200: 0.26, 300: 0.36}
# Text: dark by day is light at night.
TEXT_STOP = {600: 400, 700: 300, 800: 200, 900: 200, 950: 100}
NEUTRAL_TEXT = {
    500: 'rgb(var(--c-secondary) / {a})',
    600: 'rgb(196 189 226 / {a})',
    700: 'rgb(214 209 237 / {a})',
    800: 'rgb(var(--c-primary) / {a})',
    900: 'rgb(var(--c-primary) / {a})',
    950: 'rgb(var(--c-primary) / {a})',
}

def fill(hue, stop, op):
    if hue in NEUTRAL:
        a = NEUTRAL_FILL_ALPHA.get(stop)
        return None if a is None else f'rgb(255 255 255 / {round(a * op, 3)})'
    a = FILL_ALPHA.get(stop)
    return None if a is None else rgba(hue, 400, a * op)

def text(hue, stop, op):
    if hue in NEUTRAL:
        t = NEUTRAL_TEXT.get(stop)
        return None if t is None else t.format(a=round(op, 3))
    s = TEXT_STOP.get(stop)
    return None if s is None else rgba(hue, s, op)

def border(hue, stop, op):
    if hue in NEUTRAL:
        if stop in (100, 200):
            return f'rgb(var(--c-border) / {round(op, 3)})'
        if stop == 300:
            return f'rgb(255 255 255 / {round(0.14 * op, 3)})'
        if stop == 50:
            return f'rgb(var(--c-border) / {round(0.6 * op, 3)})'
        return None
    a = BORDER_ALPHA.get(stop)
    return None if a is None else rgba(hue, 400, a * op)

HUES = '|'.join(P.keys())
UTIL = re.compile(
    r'^(?P<prop>bg|text|border|border-[trblxy]|from|via|to|divide|ring|placeholder)-'
    r'(?:(?P<hue>' + HUES + r')-(?P<stop>50|[1-9]00|950)|(?P<bw>white|black))'
    r'(?:/(?P<op>\d{1,3}))?$'
)
PSEUDO = {
    'hover': ':hover', 'focus': ':focus', 'active': ':active', 'disabled': ':disabled',
    'focus-visible': ':focus-visible', 'focus-within': ':focus-within', 'checked': ':checked',
    'placeholder': '::placeholder', 'first': ':first-child', 'last': ':last-child',
}
MEDIA = {'sm': '(min-width: 640px)', 'md': '(min-width: 768px)', 'lg': '(min-width: 1024px)', 'xl': '(min-width: 1280px)'}
SIDE = {'t': 'top', 'r': 'right', 'b': 'bottom', 'l': 'left'}

def escape(cls):
    return re.sub(r'([:/.\[\]%#(),!])', r'\\\1', cls)

def declarations(prop, hue, stop, bw, op):
    if bw:
        if bw == 'white' and prop == 'bg':
            return [f'background-color: rgb(var(--c-surface) / {round(0.82 * op, 3)})']
        if bw == 'black' and prop == 'text':
            return [f'color: rgb(var(--c-primary) / {round(op, 3)})']
        return []
    stop = int(stop)
    if prop == 'bg':
        c = fill(hue, stop, op)
        return [f'background-color: {c}'] if c else []
    if prop in ('text', 'placeholder'):
        c = text(hue, stop, op)
        return [f'color: {c}'] if c else []
    if prop == 'border' or prop == 'divide':
        c = border(hue, stop, op)
        return [f'border-color: {c}'] if c else []
    if prop.startswith('border-'):
        c = border(hue, stop, op)
        if not c:
            return []
        side = prop[-1]
        if side in SIDE:
            return [f'border-{SIDE[side]}-color: {c}']
        if side == 'x':
            return [f'border-left-color: {c}', f'border-right-color: {c}']
        return [f'border-top-color: {c}', f'border-bottom-color: {c}']
    if prop == 'ring':
        c = border(hue, stop, op)
        return [f'--tw-ring-color: {c}'] if c else []
    if prop in ('from', 'via', 'to'):
        c = fill(hue, stop, op)
        if not c:
            return []
        if prop == 'from':
            return [f'--tw-gradient-from: {c} var(--tw-gradient-from-position)']
        if prop == 'via':
            return [f'--tw-gradient-stops: var(--tw-gradient-from), {c} var(--tw-gradient-via-position), var(--tw-gradient-to)']
        return [f'--tw-gradient-to: {c} var(--tw-gradient-to-position)']
    return []

def rule_for(token):
    parts = token.split(':')
    base = parts[-1]
    variants = parts[:-1]
    m = UTIL.match(base)
    if not m:
        return None
    op = int(m.group('op')) / 100 if m.group('op') else 1.0
    decls = declarations(m.group('prop'), m.group('hue'), m.group('stop'), m.group('bw'), op)
    if not decls:
        return None
    pseudo, prefix, media = '', '', None
    for v in variants:
        if v in PSEUDO:
            pseudo += PSEUDO[v]
        elif v == 'group-hover':
            prefix = '.group:hover '
        elif v in MEDIA and media is None:
            media = MEDIA[v]
        else:
            return None  # print:, dark: and anything else: leave alone
    if m.group('prop') == 'divide':
        target = f'.{escape(token)} > :not([hidden]) ~ :not([hidden])'
    else:
        target = f'{prefix}.{escape(token)}{pseudo}'
    selector = f'html.dark {target}:not(.no-remap *)'
    body = '; '.join(decls)
    css = f'{selector} {{ {body} }}'
    return (media, css, m.group('prop'))

def tokens():
    found = set()
    for dirpath, _, files in os.walk(ROOT):
        for name in files:
            if not name.endswith(('.tsx', '.ts')):
                continue
            with open(os.path.join(dirpath, name), encoding='utf-8') as f:
                for t in re.findall(r'[A-Za-z0-9:/\-\[\]#.]+', f.read()):
                    found.add(t.strip('.'))
    return found

def main():
    order = {'bg': 0, 'border': 1, 'border-t': 1, 'border-r': 1, 'border-b': 1, 'border-l': 1, 'border-x': 1,
             'border-y': 1, 'divide': 1, 'ring': 1, 'text': 2, 'placeholder': 2, 'from': 3, 'via': 4, 'to': 5}
    rules = []
    for t in sorted(tokens()):
        r = rule_for(t)
        if r:
            rules.append(r)
    # Gradients last and in from/via/to order, so a remapped `to` follows its `from`.
    rules.sort(key=lambda r: (r[0] or '', order.get(r[2], 9)))
    plain = [css for media, css, _ in rules if media is None]
    lines = [
        '/* Generated by scripts/gen-night-css.py - do not edit by hand; run the script. */',
        '/* The night version of every fixed colour in the screens. See the script for why. */',
        '',
    ]
    lines += plain
    for media in sorted({m for m, _, _ in rules if m}):
        lines.append(f'@media {media} {{')
        lines += ['  ' + css for m, css, _ in rules if m == media]
        lines.append('}')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'{len(rules)} night colours written to {os.path.relpath(OUT)}')

if __name__ == '__main__':
    main()
