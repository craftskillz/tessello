#!/usr/bin/env python3
"""Validate a supplied local dependency graph and render one typed view."""
import argparse
import json
from pathlib import Path
import sys

KINDS = {'import', 'type', 'call', 'event', 'data', 'config'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def local_path(root, value, file_only=False):
    require(nonempty(value), 'path must be a nonempty string')
    path = Path(value)
    require(not path.is_absolute() and '..' not in path.parts, f'not a project-relative path: {value}')
    resolved = (root / path).resolve()
    require(resolved.is_relative_to(root), f'path escapes project: {value}')
    require(resolved.is_file() if file_only else resolved.exists(), f'missing path: {value}')
    return resolved


def validate(data, root):
    require(isinstance(data, dict), 'graph must be an object')
    require(type(data.get('version')) is int and data['version'] == 1, 'expected version 1')
    require(data.get('granularity') in ('file', 'symbol', 'module'), 'invalid granularity')
    for key in ('snapshot', 'scope'):
        require(nonempty(data.get(key)), f'missing {key}')
    for key in ('features', 'limitations'):
        require(isinstance(data.get(key), list) and all(nonempty(x) for x in data[key]), f'invalid {key}')
    require(len(set(data['features'])) == len(data['features']), 'duplicate feature IDs')
    require(isinstance(data.get('nodes'), list) and isinstance(data.get('edges'), list), 'nodes and edges must be lists')
    nodes = {}
    for node in data['nodes']:
        require(isinstance(node, dict), 'node must be an object')
        ident = node.get('id')
        require(nonempty(ident) and ident not in nodes, 'missing or duplicate node ID')
        require(nonempty(node.get('label')), f'missing label: {ident}')
        local_path(root, node.get('path'), data['granularity'] != 'module')
        features = node.get('features')
        require(isinstance(features, list) and all(nonempty(x) for x in features), f'invalid features: {ident}')
        require(len(set(features)) == len(features) and set(features) <= set(data['features']), f'undeclared/duplicate features: {ident}')
        nodes[ident] = node
    seen = set()
    lines = {}
    for edge in data['edges']:
        require(isinstance(edge, dict), 'edge must be an object')
        source, target, kind = edge.get('from'), edge.get('to'), edge.get('kind')
        require(all(nonempty(x) for x in (source, target, kind)), 'invalid edge fields')
        require(source in nodes and target in nodes, 'unknown edge endpoint')
        require(kind in KINDS, f'unknown edge kind: {kind}')
        key = (source, target, kind)
        require(key not in seen, f'duplicate edge: {key}; merge its evidence')
        seen.add(key)
        evidence = edge.get('evidence')
        require(isinstance(evidence, list) and evidence, f'missing evidence: {key}')
        for item in evidence:
            require(isinstance(item, dict), 'evidence must be an object')
            path = local_path(root, item.get('path'), True)
            if path not in lines:
                lines[path] = len(path.read_text(encoding='utf-8').splitlines())
            line = item.get('line')
            require(type(line) is int and 1 <= line <= lines[path], f'invalid evidence line: {path}:{line}')
            require(nonempty(item.get('note')), 'evidence note is required')
    return nodes


def components(adjacency):
    """Iterative Kosaraju: avoids recursion limits on large supplied graphs."""
    visited, order = set(), []
    for start in sorted(adjacency):
        if start in visited:
            continue
        visited.add(start)
        stack = [(start, iter(sorted(adjacency[start])))]
        while stack:
            node, neighbors = stack[-1]
            nxt = next(neighbors, None)
            if nxt is None:
                order.append(node)
                stack.pop()
            elif nxt not in visited:
                visited.add(nxt)
                stack.append((nxt, iter(sorted(adjacency[nxt]))))
    reverse = {node: set() for node in adjacency}
    for node, targets in adjacency.items():
        for target in targets:
            reverse[target].add(node)
    visited, result = set(), []
    for start in reversed(order):
        if start in visited:
            continue
        group, stack = [], [start]
        visited.add(start)
        while stack:
            node = stack.pop()
            group.append(node)
            for nxt in sorted(reverse[node]):
                if nxt not in visited:
                    visited.add(nxt)
                    stack.append(nxt)
        result.append(sorted(group))
    return sorted(result)


def safe(value):
    # Numeric entities keep arbitrary source labels out of Markdown/Mermaid syntax.
    return ''.join(c if c.isalnum() or c in ' /._-' else f'&#{ord(c)};' for c in str(value))


def render(data, nodes, kind):
    edges = sorted((e for e in data['edges'] if e['kind'] == kind), key=lambda e: (e['from'], e['to']))
    adjacency = {node: set() for node in nodes}
    incoming = {node: set() for node in nodes}
    for edge in edges:
        adjacency[edge['from']].add(edge['to'])
        incoming[edge['to']].add(edge['from'])
    ids = {node: f'n{i}' for i, node in enumerate(sorted(nodes))}
    out = [f'# {kind.capitalize()} dependency view', '', f'Snapshot: {safe(data["snapshot"])}', '',
           f'Scope: {safe(data["scope"])}', '', f'Granularity: {data["granularity"]}. Only `{kind}` edges are included.', '',
           'Limits: ' + ('; '.join(safe(x) for x in data['limitations']) or 'None recorded by collector; source completeness is not checked.'), '',
           '## Diagram', '', '```mermaid', 'flowchart LR']
    for node in sorted(nodes):
        out.append(f'  {ids[node]}["{safe(nodes[node]["label"])}"]')
    for edge in edges:
        out.append(f'  {ids[edge["from"]]} -->|{kind}| {ids[edge["to"]]}')
    out += ['```', '', '## Cyclic components', '', 'These are strongly connected groups, not an ordered cycle path. Interpret against source evidence.', '']
    cyclic = [g for g in components(adjacency) if len(g) > 1 or g[0] in adjacency[g[0]]]
    out += ['- ' + ', '.join(f'{ids[n]} ({safe(nodes[n]["label"])})' for n in g) for g in cyclic] or ['No cycles found in the supplied graph for this relation.']
    out += ['', '## Inspection candidates', '', 'Counts are not god-object diagnoses.', '',
            '| Node | Source path | Incoming | Outgoing | Features |', '| --- | --- | ---: | ---: | ---: |']
    for node in sorted(nodes, key=lambda n: (-len(nodes[n]['features']), -len(adjacency[n]), n)):
        out.append(f'| {ids[node]} | {safe(nodes[node]["path"])} | {len(incoming[node])} | {len(adjacency[node])} | {len(nodes[node]["features"])} |')
    out += ['', '## Edge evidence', '']
    for edge in edges:
        out.append(f'- {ids[edge["from"]]} → {ids[edge["to"]]}: ' + '; '.join(
            f'{safe(e["path"])}:{e["line"]} — {safe(e["note"])}' for e in edge['evidence']))
    return '\n'.join(out) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('graph', type=Path)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--kind', choices=sorted(KINDS), default='import')
    args = parser.parse_args()
    try:
        root = args.root.resolve()
        require(root.is_dir(), 'project root must be a directory')
        data = json.loads(args.graph.read_text(encoding='utf-8'))
        nodes = validate(data, root)
        print(render(data, nodes, args.kind), end='')
    except (ValueError, OSError, TypeError) as exc:
        print(f'Invalid graph: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
