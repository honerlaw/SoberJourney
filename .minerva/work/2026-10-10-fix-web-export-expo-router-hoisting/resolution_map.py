"""Compare two package-lock.json files (base vs branch) for success criterion 2.

Usage:
    git show origin/main:package-lock.json > /tmp/lock-main.json
    python3 -I resolution_map.py /tmp/lock-main.json package-lock.json

Reports three things:
1. Set equality of name@version pairs (install path ignored, nested copies included).
2. Per-consumer resolution: for every lockfile entry and each declared dependency/peer,
   simulate Node's upward node_modules lookup (workspace links followed) and compare
   (consumer name@version, dep) -> resolved version.
3. Install-relevant metadata per name@version: integrity, hasInstallScript and the
   dev/optional/devOptional/peer flags (union across copies).

Limits: resolution is simulated from lockfile paths, not by running Node; it does not
model package.json "exports"/self-references, and flags are compared per name@version,
not per copy.
"""
import json
import sys

FLAGS = ('dev', 'optional', 'devOptional', 'peer')


def load(f):
    return json.load(open(f))['packages']


def name(k, v):
    return v.get('name') or k.split('node_modules/')[-1]


def resolution_map(l):
    def resolve(path, dep):
        p = path
        while True:
            cand = (p + '/node_modules/' + dep) if p else 'node_modules/' + dep
            if cand in l:
                e = l[cand]
                if e.get('link'):
                    e = l[e['resolved']]
                return e.get('version')
            if not p:
                return None
            i = p.rfind('/node_modules/')
            if i >= 0:
                p = p[:i]
            elif p.startswith('node_modules/'):
                p = ''
            else:
                p = p.rsplit('/', 1)[0] if '/' in p else ''

    m = {}
    for k, v in l.items():
        if v.get('link'):
            continue
        cname = (name(k, v) if k else '<root>') + '@' + str(v.get('version'))
        for sect in ('dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies'):
            if sect == 'devDependencies' and k.startswith('node_modules/'):
                continue
            for d in (v.get(sect) or {}):
                m.setdefault((cname, d), set()).add(resolve(k, d))
    return m


def versions(l):
    return {(name(k, v), v.get('version')) for k, v in l.items() if k and not v.get('link')}


def metadata(l):
    out = {}
    for k, v in l.items():
        if not k or v.get('link'):
            continue
        e = out.setdefault((name(k, v), v.get('version')), {'integrity': set(), 'hasInstallScript': set(), 'flags': set()})
        e['integrity'].add(v.get('integrity'))
        e['hasInstallScript'].add(bool(v.get('hasInstallScript')))
        e['flags'].add(tuple(f for f in FLAGS if v.get(f)))
    return out


def main(base_path, branch_path):
    a, b = load(base_path), load(branch_path)

    va, vb = versions(a), versions(b)
    print('name@version pairs:', len(va), len(vb), '| only in base:', sorted(va - vb), '| only in branch:', sorted(vb - va))

    ra, rb = resolution_map(a), resolution_map(b)
    diff = {k: (ra.get(k), rb.get(k)) for k in set(ra) | set(rb) if ra.get(k) != rb.get(k)}
    print('consumer/dependency pairs:', len(ra), len(rb), '| differing:', len(diff))
    for k, v in sorted(diff.items()):
        print(' ', k, v)

    ma, mb = metadata(a), metadata(b)
    mdiff = {k: (ma[k], mb[k]) for k in set(ma) & set(mb) if ma[k] != mb[k]}
    print('name@version metadata differing (integrity/hasInstallScript/flags):', len(mdiff))
    for k, (x, y) in sorted(mdiff.items()):
        print(' ', k, {f: (sorted(x[f], key=str), sorted(y[f], key=str)) for f in x if x[f] != y[f]})


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
