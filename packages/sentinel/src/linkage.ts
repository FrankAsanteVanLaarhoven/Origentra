/**
 * Sock-puppet / ban-evasion linkage graph.
 *
 * Edges are SIGNED assertions that two accounts are likely the same actor, each
 * with a confidence and its evidence. A "cluster" is the set reachable via edges
 * at or above a confidence threshold — this is probabilistic EVIDENCE of
 * correlation, never a hard identity claim. Low-confidence edges are excluded
 * from clustering; they exist for human review, not automatic action.
 */

import type { TrustStore } from '../../core/src/index.ts';
import { verifyLinkage } from './report.ts';
import type { LinkageEdge } from './types.ts';

export class LinkageGraph {
  #trust: TrustStore;
  #adj = new Map<string, { other: string; confidence: number }[]>();
  #edges: LinkageEdge[] = [];

  constructor(linkerTrust: TrustStore) {
    this.#trust = linkerTrust;
  }

  get edgeCount(): number {
    return this.#edges.length;
  }

  add(edge: LinkageEdge): boolean {
    if (!verifyLinkage(edge, this.#trust)) return false;
    this.#edges.push(edge);
    this.#link(edge.a, edge.b, edge.confidence);
    this.#link(edge.b, edge.a, edge.confidence);
    return true;
  }

  #link(x: string, y: string, confidence: number): void {
    const list = this.#adj.get(x) ?? [];
    list.push({ other: y, confidence });
    this.#adj.set(x, list);
  }

  /** Accounts reachable from `id` via edges >= minConfidence (likely same actor). */
  cluster(id: string, minConfidence = 0.5): string[] {
    const seen = new Set<string>([id]);
    const queue: string[] = [id];
    while (queue.length) {
      const n = queue.shift()!;
      for (const e of this.#adj.get(n) ?? []) {
        if (e.confidence >= minConfidence && !seen.has(e.other)) {
          seen.add(e.other);
          queue.push(e.other);
        }
      }
    }
    return [...seen].sort();
  }
}
