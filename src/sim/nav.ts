// Waypoint graph for workers. Edges connect every pair of nodes with a clear line of sight,
// so a location only lists a few corner points and the graph builds itself.
import { inRect, inflate, segmentHitsRect, type Rect, type Vec } from '../core/math.ts';

export class NavGraph {
  readonly nodes: Vec[];
  private readonly blockers: Rect[];
  private readonly adj: number[][];

  constructor(nodes: Vec[], obstacles: Rect[], clearance = 14) {
    this.blockers = obstacles.map((r) => inflate(r, clearance));
    // Drop nodes that sit inside an obstacle; they could never be reached.
    this.nodes = nodes.filter((n) => !this.blockers.some((b) => inRect(b, n.x, n.y)));
    this.adj = this.nodes.map(() => []);
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i]!;
        const b = this.nodes[j]!;
        if (this.clear(a.x, a.y, b.x, b.y)) {
          this.adj[i]!.push(j);
          this.adj[j]!.push(i);
        }
      }
    }
  }

  /** Line of sight between two points. Blockers containing an endpoint are ignored so zones next to walls still work. */
  clear(ax: number, ay: number, bx: number, by: number): boolean {
    for (const r of this.blockers) {
      if (inRect(r, ax, ay) || inRect(r, bx, by)) continue;
      if (segmentHitsRect(ax, ay, bx, by, r)) return false;
    }
    return true;
  }

  /** Path from a to b as a list of points to walk through (b included, a excluded). */
  path(ax: number, ay: number, bx: number, by: number): Vec[] {
    if (this.clear(ax, ay, bx, by)) return [{ x: bx, y: by }];
    const n = this.nodes.length;
    const startLinks: number[] = [];
    const goalLinks = new Set<number>();
    for (let i = 0; i < n; i++) {
      const p = this.nodes[i]!;
      if (this.clear(ax, ay, p.x, p.y)) startLinks.push(i);
      if (this.clear(p.x, p.y, bx, by)) goalLinks.add(i);
    }
    if (startLinks.length === 0 || goalLinks.size === 0) return [{ x: bx, y: by }];

    // A* over nodes; the virtual goal is reached from any node in goalLinks.
    const g = new Array<number>(n).fill(Infinity);
    const f = new Array<number>(n).fill(Infinity);
    const from = new Array<number>(n).fill(-1);
    const open = new Set<number>();
    const h = (i: number): number => Math.hypot(this.nodes[i]!.x - bx, this.nodes[i]!.y - by);
    for (const i of startLinks) {
      g[i] = Math.hypot(this.nodes[i]!.x - ax, this.nodes[i]!.y - ay);
      f[i] = g[i]! + h(i);
      open.add(i);
    }
    let best = -1;
    let bestCost = Infinity;
    while (open.size > 0) {
      let cur = -1;
      let curF = Infinity;
      for (const i of open) {
        if (f[i]! < curF) {
          curF = f[i]!;
          cur = i;
        }
      }
      if (curF >= bestCost) break;
      open.delete(cur);
      if (goalLinks.has(cur)) {
        const total = g[cur]! + h(cur);
        if (total < bestCost) {
          bestCost = total;
          best = cur;
        }
      }
      for (const nb of this.adj[cur]!) {
        const cand = g[cur]! + Math.hypot(this.nodes[nb]!.x - this.nodes[cur]!.x, this.nodes[nb]!.y - this.nodes[cur]!.y);
        if (cand < g[nb]!) {
          g[nb] = cand;
          f[nb] = cand + h(nb);
          from[nb] = cur;
          open.add(nb);
        }
      }
    }
    if (best < 0) return [{ x: bx, y: by }];
    const out: Vec[] = [{ x: bx, y: by }];
    for (let i = best; i >= 0; i = from[i]!) out.push({ ...this.nodes[i]! });
    out.reverse();
    return out;
  }
}
