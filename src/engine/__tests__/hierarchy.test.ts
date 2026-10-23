import { describe, it, expect } from 'vitest';
import { CapsuleNode } from '../../types';
import {
  buildPageTree,
  filterPageTree,
  nodeMap,
  pageAncestors,
  pageBreadcrumbs,
  pageChildren,
  pageDescendantIds,
  pageLineage,
  pageRoots,
  resolveParentId,
  wouldCreatePageCycle,
} from '../hierarchy';

const makeNode = (messageId: string, subject: string, parentId?: string): CapsuleNode => ({
  messageId,
  subject,
  from: 'Local user <user@local>',
  to: 'Vault <vault@local>',
  date: 'Wed, 22 Oct 2025 10:00:00 +0000',
  timestamp: 1761127200000,
  parentId,
  references: [],
  tags: [],
  status: 'Active',
  fileName: `${messageId.replace(/[^a-z0-9]/gi, '_')}.eml`,
  blocks: [],
  attachments: [],
});

const tree = () => {
  const nodes = [
    makeNode('<root@vault>', 'Root'),
    makeNode('<b@vault>', 'Beta', '<root@vault>'),
    makeNode('<a@vault>', 'Alpha', '<root@vault>'),
    makeNode('<a1@vault>', 'Alpha one', '<a@vault>'),
  ];
  return nodeMap(nodes);
};

describe('page hierarchy', () => {
  it('returns roots and children in stable alphabetical order', () => {
    const nodes = tree();
    expect(pageRoots(nodes).map((n) => n.subject)).toEqual(['Root']);
    expect(pageChildren(nodes, '<root@vault>').map((n) => n.subject)).toEqual(['Alpha', 'Beta']);
    expect(pageChildren(nodes, '<a@vault>').map((n) => n.subject)).toEqual(['Alpha one']);
  });

  it('promotes a page whose parent is missing to a root', () => {
    const nodes = nodeMap([
      makeNode('<root@vault>', 'Root'),
      makeNode('<orphan@vault>', 'Orphan', '<deleted@vault>'),
    ]);

    expect(resolveParentId(nodes, '<orphan@vault>')).toBeNull();
    expect(pageRoots(nodes).map((n) => n.messageId)).toEqual([
      '<orphan@vault>',
      '<root@vault>',
    ]);
  });

  it('builds ancestors and breadcrumbs from root to self', () => {
    const nodes = tree();
    expect(pageAncestors(nodes, '<a1@vault>').map((n) => n.subject)).toEqual(['Root', 'Alpha']);
    expect(pageBreadcrumbs(nodes, '<a1@vault>').map((n) => n.subject)).toEqual([
      'Root',
      'Alpha',
      'Alpha one',
    ]);
  });

  it('rejects direct and indirect cycles', () => {
    const nodes = tree();
    expect(wouldCreatePageCycle(nodes, '<a@vault>', '<a@vault>')).toBe(true);
    expect(wouldCreatePageCycle(nodes, '<root@vault>', '<a1@vault>')).toBe(true);
    expect(wouldCreatePageCycle(nodes, '<a@vault>', '<b@vault>')).toBe(false);
    expect(wouldCreatePageCycle(nodes, '<a@vault>', null)).toBe(false);
  });

  it('does not loop on already-corrupt parent cycles', () => {
    const nodes = nodeMap([
      makeNode('<x@vault>', 'X', '<y@vault>'),
      makeNode('<y@vault>', 'Y', '<x@vault>'),
    ]);

    const items = buildPageTree(nodes);
    const ids = items.flatMap(function collect(item): string[] {
      return [item.node.messageId, ...item.children.flatMap(collect)];
    });

    expect(items).toHaveLength(1);
    expect(ids.sort()).toEqual(['<x@vault>', '<y@vault>']);
    expect(pageAncestors(nodes, '<x@vault>').map((n) => n.messageId)).toEqual(['<y@vault>']);
  });

  it('lists descendants without including the page itself', () => {
    const nodes = tree();
    expect(Array.from(pageDescendantIds(nodes, '<root@vault>')).sort()).toEqual([
      '<a1@vault>',
      '<a@vault>',
      '<b@vault>',
    ]);
  });

  it('filters the tree while keeping ancestors for context', () => {
    const nodes = tree();
    const visible = pageLineage(nodes, ['<a1@vault>']);
    const filtered = filterPageTree(buildPageTree(nodes), visible);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].node.messageId).toBe('<root@vault>');
    expect(filtered[0].children).toHaveLength(1);
    expect(filtered[0].children[0].node.messageId).toBe('<a@vault>');
    expect(filtered[0].children[0].children[0].node.messageId).toBe('<a1@vault>');
  });
});
