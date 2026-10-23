import { CapsuleNode } from '../types';

/**
 * Page hierarchy (wiki-style sub-pages).
 *
 * Hierarchy is intentionally separate from mail threading:
 *   - `parentId` (X-Capsule-Page-Parent) = page tree
 *   - `inReplyTo` / `references`        = mail thread
 *
 * Rules:
 *   - an unknown or dangling parent is treated as "no parent" (promoted to root)
 *   - deleting a page never cascades; children become roots
 *   - reparenting rejects cycles before touching the store
 */

export type PageNodeMap = ReadonlyMap<string, CapsuleNode>;

export interface PageTreeItem {
  node: CapsuleNode;
  children: PageTreeItem[];
}

export interface PageRef {
  messageId: string;
  subject: string;
}

function bySubject(a: CapsuleNode, b: CapsuleNode): number {
  const sa = (a.subject || '').toLowerCase();
  const sb = (b.subject || '').toLowerCase();
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return a.timestamp - b.timestamp;
}

/**
 * One pass over the vault → parent → children index. `buildPageTree` and
 * `pageDescendantIds` run on every store change, so they must stay O(n),
 * not O(n²) via repeated full scans.
 */
function childrenIndex(nodes: PageNodeMap): Map<string | null, CapsuleNode[]> {
  const index = new Map<string | null, CapsuleNode[]>();
  for (const node of nodes.values()) {
    const parentId = resolveParentId(nodes, node.messageId);
    const bucket = index.get(parentId);
    if (bucket) bucket.push(node);
    else index.set(parentId, [node]);
  }
  for (const bucket of index.values()) bucket.sort(bySubject);
  return index;
}

export function nodeMap(nodes: readonly CapsuleNode[]): PageNodeMap {
  return new Map(nodes.map((node) => [node.messageId, node]));
}

/** Parent id only when it points at a different, existing page. */
export function resolveParentId(nodes: PageNodeMap, pageId: string): string | null {
  const node = nodes.get(pageId);
  const parentId = node?.parentId;
  if (!parentId || parentId === pageId) return null;
  return nodes.has(parentId) ? parentId : null;
}

/** Direct children, alphabetically (predictable wiki sidebar order). */
export function pageChildren(nodes: PageNodeMap, parentId: string | null): CapsuleNode[] {
  return childrenIndex(nodes).get(parentId) || [];
}

/** Root pages. Dangling parents are promoted so nothing disappears. */
export function pageRoots(nodes: PageNodeMap): CapsuleNode[] {
  const result: CapsuleNode[] = [];
  for (const node of nodes.values()) {
    if (resolveParentId(nodes, node.messageId) === null) result.push(node);
  }
  return result.sort(bySubject);
}

/** Root → parent chain (self excluded). Cycle-safe. */
export function pageAncestors(nodes: PageNodeMap, pageId: string): CapsuleNode[] {
  const ancestors: CapsuleNode[] = [];
  const seen = new Set<string>([pageId]);
  let current = resolveParentId(nodes, pageId);

  while (current && !seen.has(current)) {
    const node = nodes.get(current);
    if (!node) break;
    seen.add(current);
    ancestors.unshift(node);
    current = resolveParentId(nodes, current);
  }

  return ancestors;
}

export function pageBreadcrumbs(nodes: PageNodeMap, pageId: string): PageRef[] {
  const self = nodes.get(pageId);
  if (!self) return [];
  return [
    ...pageAncestors(nodes, pageId).map((node) => ({
      messageId: node.messageId,
      subject: node.subject,
    })),
    { messageId: self.messageId, subject: self.subject },
  ];
}

export function pageDepth(nodes: PageNodeMap, pageId: string): number {
  return pageAncestors(nodes, pageId).length;
}

/** True when making `newParentId` the parent of `pageId` would close a loop. */
export function wouldCreatePageCycle(
  nodes: PageNodeMap,
  pageId: string,
  newParentId: string | null | undefined,
): boolean {
  if (!newParentId) return false;
  if (newParentId === pageId) return true;
  if (!nodes.has(newParentId)) return false;

  const seen = new Set<string>([newParentId]);
  let current: string | null = newParentId;

  while (current) {
    if (current === pageId) return true;
    const node = nodes.get(current);
    const next = node?.parentId && node.parentId !== current ? node.parentId : null;
    if (!next || seen.has(next)) return false;
    seen.add(next);
    current = next;
  }

  return false;
}

export function pageDescendantIds(nodes: PageNodeMap, pageId: string): Set<string> {
  const index = childrenIndex(nodes);
  const descendants = new Set<string>();
  const queue = [...(index.get(pageId) || [])];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.messageId === pageId || descendants.has(node.messageId)) continue;
    descendants.add(node.messageId);
    queue.push(...(index.get(node.messageId) || []));
  }

  return descendants;
}

/**
 * Builds the full tree. If a malformed file set contains a parent cycle,
 * an arbitrary node from it is promoted to a root instead of rendering
 * nothing or looping forever.
 */
export function buildPageTree(nodes: PageNodeMap): PageTreeItem[] {
  const sorted = Array.from(nodes.values()).sort(bySubject);
  const index = childrenIndex(nodes);
  const visited = new Set<string>();

  const build = (node: CapsuleNode, path: Set<string>): PageTreeItem => {
    visited.add(node.messageId);
    const nextPath = new Set(path);
    nextPath.add(node.messageId);

    const children = (index.get(node.messageId) || [])
      .filter((child) => !nextPath.has(child.messageId) && !visited.has(child.messageId))
      .map((child) => build(child, nextPath));

    return { node, children };
  };

  const items: PageTreeItem[] = [];
  for (const root of index.get(null) || []) {
    items.push(build(root, new Set()));
  }

  // Cycle islands have no root by definition — promote one node so the
  // malformed branch stays visible and can be repaired via the parent picker.
  for (const node of sorted) {
    if (!visited.has(node.messageId)) items.push(build(node, new Set()));
  }

  return items;
}

/** Keep matching pages plus their ancestors; drop unrelated branches. */
export function filterPageTree(
  items: PageTreeItem[],
  visibleIds: ReadonlySet<string>,
): PageTreeItem[] {
  const filtered: PageTreeItem[] = [];

  for (const item of items) {
    const children = filterPageTree(item.children, visibleIds);
    if (visibleIds.has(item.node.messageId) || children.length > 0) {
      filtered.push({ node: item.node, children });
    }
  }

  return filtered;
}

/** Matching ids plus every ancestor needed to reach them. */
export function pageLineage(nodes: PageNodeMap, ids: Iterable<string>): Set<string> {
  const visible = new Set<string>();
  for (const id of ids) {
    if (!nodes.has(id)) continue;
    visible.add(id);
    for (const ancestor of pageAncestors(nodes, id)) visible.add(ancestor.messageId);
  }
  return visible;
}
