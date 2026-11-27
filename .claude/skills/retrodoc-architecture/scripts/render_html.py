#!/usr/bin/env python3
"""Render canonical Retrodoc Markdown pages to sibling HTML, or check existing renders."""
import argparse
from datetime import date
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote, unquote
import xml.etree.ElementTree as ET

CSS = Path(__file__).resolve().parent.parent / 'assets' / 'retrodoc.css'
SKIP_DIRS = {'node_modules'}
SAFE_SCHEMES = ('http://', 'https://', 'mailto:')
BLOCK_START = re.compile(r'^(#{1,6})\s|^\s*(```|~~~)|^\s*>|^\s*([-*+]|\d+[.)])\s|^\s*\|')
LIST_ITEM = re.compile(r'^(\s*)([-*+]|\d+[.)])\s+(.*)$')
MERMAID_PENDING, MERMAID_SPLIT = '<!--mermaid-->', '<!--/notice-->'
META = re.compile(r'<meta name="(retrodoc-source(?:-sha256)?)" content="([^"]*)"')
SVG_TAGS = {'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
            'title', 'desc', 'defs', 'marker', 'use', 'symbol', 'linearGradient', 'radialGradient', 'stop',
            'clipPath', 'pattern', 'mask'}


# ── workspace ────────────────────────────────────────────────────────────────
class Workspace:
    def __init__(self, root):
        self.root = Path(root).resolve()
        if not self.root.is_dir():
            raise ValueError(f'not a directory: {root}')
        self.context_path = self.root / 'retrodoc-context.json'
        self.context = {}
        if self.context_path.is_file():
            self.context = json.loads(self.context_path.read_text(encoding='utf-8'))
        index = self.context.get('index') or ('README.md' if (self.root / 'README.md').is_file() else 'RETRODOC.md')
        self.index = self.root / index
        self.html_index = self.root / (self.context.get('html_index') or 'index.html')
        if 'html_index' not in self.context and self.html_index.exists() and not is_retrodoc_html(self.html_index):
            self.html_index = self.root / 'retrodoc-index.html'

    def pages(self):
        return sorted(p for p in self.root.rglob('*.md')
                      if not any(part.startswith('.') or part in SKIP_DIRS for part in p.relative_to(self.root).parts))

    def html_for(self, md):
        return self.html_index if md == self.index else md.with_suffix('.html')

    def record_html_index(self):
        if self.context and self.context.get('html_index') != self.html_index.name and self.html_index.name != 'index.html':
            self.context['html_index'] = self.html_index.name
            self.context_path.write_text(json.dumps(self.context, indent=2) + '\n', encoding='utf-8')


def is_retrodoc_html(path):
    return path.is_file() and 'name="retrodoc-source"' in path.read_text(encoding='utf-8', errors='replace')


def rel_href(target, from_dir):
    return '/'.join(quote(part) for part in Path(os.path.relpath(target, from_dir)).parts) or '.'


# ── markdown parsing ─────────────────────────────────────────────────────────
def split_front_matter(text):
    meta = {}
    if text.startswith('---\n'):
        end = text.find('\n---\n', 4)
        if end != -1:
            for line in text[4:end].splitlines():
                key, sep, value = line.partition(':')
                if sep and key.strip():
                    meta[key.strip()] = value.strip().strip('"\'')
            return meta, text[end + 5:]
    return meta, text


def slugify(text):
    text = re.sub(r'<[^>]+>|[`*_\[\]]|\]\([^)]*\)', '', text).lower()
    return re.sub(r'\s+', '-', re.sub(r'[^\w\s-]', '', text).strip()) or 'section'


def split_row(row):
    cells, buf, ticks, i = [], '', 0, 0
    row = row.strip()
    if row.startswith('|'):
        row = row[1:]
    if row.endswith('|') and not row.endswith('\\|'):
        row = row[:-1]
    while i < len(row):
        ch = row[i]
        if ch == '\\' and i + 1 < len(row) and row[i + 1] == '|':
            buf += '|'
            i += 2
            continue
        if ch == '`':
            ticks ^= 1
        if ch == '|' and not ticks:
            cells.append(buf.strip())
            buf = ''
        else:
            buf += ch
        i += 1
    return cells + [buf.strip()]


class Renderer:
    def __init__(self, workspace, md_path):
        self.ws = workspace
        self.md = md_path
        self.dir = md_path.parent
        self.ids = {}
        self.toc = []
        self.warnings = []
        self.pending_mermaid = 0
        self.title = ''

    def unique_id(self, base):
        count = self.ids.get(base, 0)
        self.ids[base] = count + 1
        return base if count == 0 else f'{base}-{count}'

    # inline ------------------------------------------------------------------
    def href(self, raw):
        raw = raw.strip().strip('<>')
        if raw.startswith('#'):
            return raw
        if raw.lower().startswith(SAFE_SCHEMES):
            return raw
        if re.match(r'^[a-zA-Z][\w+.-]*:', raw):
            self.warnings.append(f'unsafe link dropped: {raw}')
            return None
        base, sep, frag = raw.partition('#')
        target = (self.dir / unquote(base)).resolve()
        if target.suffix == '.md' and target.is_relative_to(self.ws.root):
            base = rel_href(self.ws.html_for(target), self.dir)
        else:
            base = quote(unquote(base), safe='/')
        return base + (sep + frag if sep else '')

    def inline(self, text):
        slots = []

        def hold(fragment):
            slots.append(fragment)
            return f'\x00{len(slots) - 1}\x00'

        def emphasis(escaped):
            escaped = re.sub(r'\*\*(.+?)\*\*|__(.+?)__', lambda m: f'<strong>{m[1] or m[2]}</strong>', escaped)
            return re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)',
                          lambda m: f'<em>{m[1] or m[2]}</em>', escaped)

        def image(m):
            src = self.href(m[2])
            return hold(f'<img src="{html.escape(src)}" alt="{html.escape(m[1])}">' if src else html.escape(m[1]))

        def link(m):
            label, target = emphasis(html.escape(m[1], quote=False)), self.href(m[2])
            return hold(f'<a href="{html.escape(target)}">{label}</a>' if target else label)

        text = re.sub(r'(`+)(.+?)\1', lambda m: hold(f'<code>{html.escape(m[2].strip())}</code>'), text)
        text = re.sub(r'!\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)', image, text)
        text = re.sub(r'\[((?:[^\[\]]|\[[^\]]*\])+)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)', link, text)
        text = re.sub(r'<(https?://[^>\s]+)>', lambda m: hold(f'<a href="{html.escape(m[1])}">{html.escape(m[1])}</a>'), text)
        text = emphasis(html.escape(text, quote=False))
        text = re.sub(r'  \n|\\\n', '<br>\n', text)
        while '\x00' in text:
            text = re.sub(r'\x00(\d+)\x00', lambda m: slots[int(m[1])], text)
        return text

    # blocks ------------------------------------------------------------------
    def blocks(self, lines, top=False):
        out, i = [], 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            if not stripped:
                i += 1
                continue
            fence = re.match(r'^\s*(```+|~~~+)\s*([\w-]*)', line)
            if fence:
                body, i = [], i + 1
                while i < len(lines) and not lines[i].strip().startswith(fence[1]):
                    body.append(lines[i])
                    i += 1
                if i >= len(lines):
                    self.warnings.append('unclosed code fence')
                i += 1
                out.append(self.fenced(fence[2].lower(), '\n'.join(body), out))
                continue
            heading = re.match(r'^(#{1,6})\s+(.*?)\s*#*\s*$', line)
            if heading:
                out.append(self.heading(len(heading[1]), heading[2], top))
                i += 1
                continue
            if re.match(r'^\s*([-*_])(\s*\1){2,}\s*$', line):
                out.append('<hr>')
                i += 1
                continue
            if stripped.startswith('>'):
                quoted = []
                while i < len(lines) and lines[i].strip().startswith('>'):
                    quoted.append(re.sub(r'^\s*>\s?', '', lines[i]))
                    i += 1
                out.append('<blockquote>' + self.blocks(quoted) + '</blockquote>')
                continue
            if stripped.startswith('|') and i + 1 < len(lines) and re.match(r'^\s*\|?[\s:|-]+\|[\s:|-]*$', lines[i + 1]):
                rows = []
                while i < len(lines) and lines[i].strip().startswith('|'):
                    rows.append(lines[i])
                    i += 1
                out.append(self.table(rows))
                continue
            if LIST_ITEM.match(line):
                i = self.list_block(lines, i, out)
                continue
            para = []
            while i < len(lines) and lines[i].strip() and not BLOCK_START.match(lines[i]):
                para.append(lines[i].strip() if not lines[i].endswith('  ') else lines[i].lstrip())
                i += 1
            if not para:
                para, i = [stripped], i + 1
            out.append(f'<p>{self.inline(chr(10).join(para))}</p>')
        return '\n'.join(out)

    def list_block(self, lines, i, out):
        first = LIST_ITEM.match(lines[i])
        indent, ordered = len(first[1]), first[2][0].isdigit()
        offset = indent + len(first[2]) + 1
        items = []
        while i < len(lines):
            line = lines[i]
            m = LIST_ITEM.match(line)
            depth = len(line) - len(line.lstrip())
            if m and len(m[1]) == indent and m[2][0].isdigit() == ordered:
                items.append([m[3]])
            elif m and len(m[1]) < indent:
                break
            elif line.strip() and depth > indent:
                items[-1].append(line[min(offset, depth):])
            elif line.strip() and not BLOCK_START.match(line) and items[-1][-1].strip():
                items[-1].append(line.strip())
            elif not line.strip() and i + 1 < len(lines) and len(lines[i + 1]) - len(lines[i + 1].lstrip()) > indent:
                items[-1].append('')
            else:
                break
            i += 1
        rendered = []
        for item in items:
            head = [item[0]]
            rest = item[1:]
            while rest and rest[0].strip() and not BLOCK_START.match(rest[0]):
                head.append(rest.pop(0).strip())
            rendered.append(f'<li>{self.inline(chr(10).join(head))}{self.blocks(rest) if rest else ""}</li>')
        tag = 'ol' if ordered else 'ul'
        start = first[2][:-1] if ordered and first[2][:-1] != '1' else ''
        out.append(f'<{tag}' + (f' start="{start}"' if start else '') + '>' + ''.join(rendered) + f'</{tag}>')
        return i

    def heading(self, level, text, top):
        anchor = self.unique_id(slugify(text))
        if level == 1 and not self.title:
            self.title = text
            return ''
        if level == 2 and top:
            self.toc.append((anchor, text))
            css = 'card callout' if slugify(text) == 'key-reading' else 'card'
            return f'\x01<section class="{css}" aria-labelledby="{anchor}"><h2 id="{anchor}">{self.inline(text)}</h2>'
        return f'<h{level} id="{anchor}">{self.inline(text)}</h{level}>'

    def table(self, rows):
        head = split_row(rows[0])
        caption = self.toc[-1][1] if self.toc else (self.title or 'Table')
        parts = [f'<div class="table-scroll" role="region" aria-label="{html.escape(caption)} table" tabindex="0"><table>',
                 f'<caption>{self.inline(caption)}</caption><thead><tr>',
                 ''.join(f'<th scope="col">{self.inline(c)}</th>' for c in head), '</tr></thead><tbody>']
        for row in rows[2:]:
            cells = split_row(row)
            cells += [''] * (len(head) - len(cells))
            parts.append('<tr>' + ''.join(f'<td>{self.inline(c)}</td>' for c in cells[:len(head)]) + '</tr>')
        return ''.join(parts) + '</tbody></table></div>'

    def fenced(self, lang, body, out):
        code = '<pre><code' + (f' class="language-{lang}"' if lang else '') + f'>{html.escape(body)}</code></pre>'
        if lang == 'svg':
            figure = f'<figure class="diagram-scroll">{self.sanitize_svg(body)}</figure>'
            if out and out[-1].startswith(MERMAID_PENDING):
                self.pending_mermaid -= 1
                out[-1] = out[-1][len(MERMAID_PENDING):].split(MERMAID_SPLIT, 1)[1]
                return figure
            return figure
        if lang == 'mermaid':
            self.pending_mermaid += 1
            return (MERMAID_PENDING + '<div class="callout warning" data-retrodoc-incomplete="diagram">'
                    '<strong>Diagram not rendered.</strong> No SVG rendering follows this Mermaid source; '
                    'read the relation list and source below.</div>' + MERMAID_SPLIT +
                    f'<details><summary>Mermaid source</summary>{code}</details>')
        return code

    def sanitize_svg(self, body):
        try:
            root = ET.fromstring(body)
        except ET.ParseError as exc:
            self.warnings.append(f'invalid SVG dropped: {exc}')
            return '<p class="callout warning">Invalid SVG omitted.</p>'

        def local(name):
            return name.rsplit('}', 1)[-1]

        def clean(node):
            for child in list(node):
                if local(child.tag) not in SVG_TAGS:
                    node.remove(child)
                    self.warnings.append(f'SVG element removed: {local(child.tag)}')
                else:
                    clean(child)
            attributes = {local(k): v for k, v in node.attrib.items()}
            node.attrib.clear()
            for name, value in attributes.items():
                if not (name.lower().startswith('on') or (name == 'href' and not value.startswith('#'))
                        or 'javascript:' in value.lower() or name == 'xmlns'):
                    node.set(name, value)
            node.tag = local(node.tag)

        if local(root.tag) != 'svg':
            self.warnings.append('SVG fence without <svg> root dropped')
            return ''
        clean(root)
        root.set('xmlns', 'http://www.w3.org/2000/svg')
        prefix = self.unique_id('fig')
        for node in root.iter():
            if 'id' in node.attrib:
                node.set('id', f'{prefix}-{node.get("id")}')
            for attr, value in list(node.attrib.items()):
                if attr != 'id':
                    node.set(attr, re.sub(r'url\(#([^)]+)\)', rf'url(#{prefix}-\1)', value))
                    if attr == 'href' and value.startswith('#'):
                        node.set(attr, f'#{prefix}-{value[1:]}')
        return ET.tostring(root, encoding='unicode')

    # page ----------------------------------------------------------------------
    def render(self, raw_bytes, today):
        text = raw_bytes.decode('utf-8').replace('\r\n', '\n')
        meta, body = split_front_matter(text)
        self.title = meta.get('title', '')
        lines = body.split('\n')
        lead = ''
        first = next((n for n, l in enumerate(lines) if l.strip() and not l.startswith('# ')), None)
        if first is not None and not BLOCK_START.match(lines[first]):
            end = first
            while end < len(lines) and lines[end].strip() and not BLOCK_START.match(lines[end]):
                end += 1
            lead = self.inline(' '.join(l.strip() for l in lines[first:end]))
            lines = lines[:first] + lines[end:]
        content = self.blocks(lines, top=True)
        sections = content.split('\x01')
        content = sections[0] + ''.join(s + '</section>' for s in sections[1:])
        self.title = self.title or self.md.stem
        index_href = rel_href(self.ws.html_index, self.dir)
        md_href = quote(self.md.name)
        crumbs = f'<a href="{index_href}">Atlas</a>' + ('' if self.md == self.ws.index else f' / {html.escape(self.title)}')
        strip = ''.join(f'<span>{label}: {self.inline(meta[key])}</span>' for key, label in
                        (('snapshot', 'Snapshot'), ('inspected', 'Inspected'), ('scope', 'Scope')) if meta.get(key))
        strip += f'<span>Rendered: {today}</span>'
        if meta.get('status'):
            strip += f'<span>Status: <span class="badge">{html.escape(meta["status"])}</span></span>'
        toc = ''.join(f'<li><a href="#{a}">{self.inline(t)}</a></li>' for a, t in self.toc)
        source = quote(self.md.relative_to(self.ws.root).as_posix())
        return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="retrodoc-source" content="{html.escape(source)}">
<meta name="retrodoc-source-sha256" content="{hashlib.sha256(raw_bytes).hexdigest()}">
<title>{html.escape(re.sub(r'[`*_]', '', self.title))} — Retrodoc</title>
<style>{CSS.read_text(encoding='utf-8')}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header>
<nav aria-label="Breadcrumb" class="meta">{crumbs}</nav>
<h1>{self.inline(self.title)}</h1>
{f'<p>{lead}</p>' if lead else ''}
<div class="meta">{strip}</div>
</header>
<div class="layout">
<nav class="toc" aria-label="Table of contents"><ul>{toc}</ul></nav>
<main id="main">
<article>
{content}
</article>
</main>
</div>
<footer><p>Generated from <a href="{md_href}">{html.escape(self.md.name)}</a> (canonical Markdown) · <a href="{index_href}">Atlas index</a>. Source links open only where the source tree is reachable from this location.</p></footer>
</body>
</html>
'''


# ── commands ─────────────────────────────────────────────────────────────────
def render(ws, selected, force=False, today=None):
    today = today or date.today().isoformat()
    report = {'written': [], 'unchanged': [], 'skipped': [], 'warnings': []}
    for md in selected:
        target = ws.html_for(md)
        raw = md.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        rel = target.relative_to(ws.root).as_posix()
        if target.exists() and not is_retrodoc_html(target):
            report['skipped'].append(f'{rel} (unrelated HTML; not overwritten)')
            continue
        current = target.read_text(encoding='utf-8') if target.exists() else ''
        if not force and f'content="{digest}"' in current and f'href="{rel_href(ws.html_index, md.parent)}"' in current:
            report['unchanged'].append(rel)
            continue
        renderer = Renderer(ws, md)
        target.write_text(renderer.render(raw, today), encoding='utf-8')
        report['written'].append(rel)
        if renderer.pending_mermaid:
            renderer.warnings.append(f'{renderer.pending_mermaid} Mermaid diagram(s) without an SVG rendering')
        report['warnings'] += [f'{md.relative_to(ws.root).as_posix()}: {w}' for w in renderer.warnings]
    ws.record_html_index()
    return report


def check(ws, selected):
    problems, ids_by_file = [], {}
    pages = {ws.html_for(md): md for md in selected}
    for html_path, md in pages.items():
        rel = html_path.relative_to(ws.root).as_posix()
        if not html_path.is_file():
            problems.append(f'{rel}: missing HTML for {md.relative_to(ws.root).as_posix()}')
            continue
        content = html_path.read_text(encoding='utf-8')
        meta = dict(META.findall(content))
        if meta.get('retrodoc-source-sha256') != hashlib.sha256(md.read_bytes()).hexdigest():
            problems.append(f'{rel}: stale (source hash differs; re-render)')
        if unquote(meta.get('retrodoc-source', '')) != md.relative_to(ws.root).as_posix():
            problems.append(f'{rel}: retrodoc-source does not name {md.relative_to(ws.root).as_posix()}')
        ids = re.findall(r'\sid="([^"]+)"', content)
        duplicates = sorted({i for i in ids if ids.count(i) > 1})
        if duplicates:
            problems.append(f'{rel}: duplicate IDs {", ".join(duplicates)}')
        ids_by_file[html_path] = set(ids)
        if 'data-retrodoc-incomplete' in content:
            problems.append(f'{rel}: contains an incomplete (unrendered) diagram')
        if ws.html_index.name not in content:
            problems.append(f'{rel}: no navigation back to {ws.html_index.name}')
    for html_path in pages:
        if not html_path.is_file():
            continue
        for href in re.findall(r'<a href="([^"]+)"', html_path.read_text(encoding='utf-8')):
            if href.lower().startswith(SAFE_SCHEMES):
                continue
            base, _, frag = href.partition('#')
            target = (html_path.parent / unquote(base)).resolve() if base else html_path
            if not target.exists():
                problems.append(f'{html_path.relative_to(ws.root).as_posix()}: broken link {href}')
            elif frag and target.suffix == '.html':
                known = ids_by_file.get(target)
                if known is None:
                    known = set(re.findall(r'\sid="([^"]+)"', target.read_text(encoding='utf-8')))
                    ids_by_file[target] = known
                if unquote(frag) not in known:
                    problems.append(f'{html_path.relative_to(ws.root).as_posix()}: missing fragment {href}')
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('docs_root', help='Retrodoc output root (DOCS_ROOT)')
    parser.add_argument('pages', nargs='*', help='Markdown pages to process (default: every page in DOCS_ROOT)')
    parser.add_argument('--check', action='store_true', help='Verify hashes, links, fragments and IDs without writing')
    parser.add_argument('--force', action='store_true', help='Re-render pages whose source hash is unchanged')
    args = parser.parse_args(argv)
    try:
        ws = Workspace(args.docs_root)
        selected = [Path(p).resolve() if Path(p).is_absolute() else (Path.cwd() / p).resolve() for p in args.pages] or ws.pages()
        for md in selected:
            if md.suffix != '.md' or not md.is_file() or not md.is_relative_to(ws.root):
                raise ValueError(f'not a Markdown page inside DOCS_ROOT: {md}')
        if args.check:
            problems = check(ws, selected)
            for problem in problems:
                print(f'- {problem}')
            print(f'Checked {len(selected)} page(s): {len(problems)} problem(s).')
            return 1 if problems else 0
        report = render(ws, selected, args.force)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(exc, file=sys.stderr)
        return 2
    for key, label in (('written', 'Rendered'), ('unchanged', 'Unchanged'), ('skipped', 'Skipped'), ('warnings', 'Warning')):
        for item in report[key]:
            print(f'{label}: {item}')
    print(f'HTML index: {ws.html_index.relative_to(ws.root).as_posix()}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
