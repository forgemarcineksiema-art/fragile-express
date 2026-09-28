# Rewrites a location JSON with one pad per line (keeps diffs readable).
import json, sys

def dump(d):
    lines = ['    ' + json.dumps(x, ensure_ascii=False).replace('":', '": ').replace(',"', ', "').replace('{"', '{ "').replace('}', ' }') for x in d['pads']]
    head = json.dumps({k: v for k, v in d.items() if k != 'pads'}, indent=2, ensure_ascii=False)
    out = head[:-2] + ',\n  "pads": [\n' + ',\n'.join(lines) + '\n  ]\n}\n'
    json.loads(out)
    return out

if __name__ == '__main__':
    for p in sys.argv[1:]:
        d = json.load(open(p, encoding='utf-8'))
        open(p, 'w', encoding='utf-8', newline='\n').write(dump(d))
