from pathlib import Path

p = Path('index.html')
s = p.read_text()

old = '''  const sectionPattern =
    /^\s*(intro|verse(?:\s*\d+)?|pre[- ]?chorus|chorus|refrain|bridge|interlude|instrumental|outro|ending|tag|hook|solo)(?:\s*\d+)?\s*:?\s*$/i;'''

new = '''  const sectionPattern =
    /^\s*\[?\s*(intro|verse(?:\s*\d+)?|pre[- ]?chorus|chorus|refrain|bridge|interlude|instrumental|outro|ending|tag|hook|solo)(?:\s*\d+)?\s*:?\s*\]?\s*$/i;'''

if old not in s:
    raise SystemExit('sectionPattern target not found')

s = s.replace(old, new, 1)

old2 = '''        name:
          clean.replace(
            /:$/,
            ''
          ),'''

new2 = '''        name:
          clean
            .replace(/^\[\s*/, '')
            .replace(/\s*\]$/, '')
            .replace(/:$/, '')
            .trim(),'''

if old2 not in s:
    raise SystemExit('section name target not found')

s = s.replace(old2, new2, 1)
p.write_text(s)
print('Patched bracketed song sections')
