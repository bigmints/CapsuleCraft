import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vaultStore } from '../vaultStore';
import * as desktopStore from '../desktopStore';
import { assembleEml } from '../mime';
import { CapsuleNode } from '../../types';

describe('Vault Folder Watching & Sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ingests a newly created external .eml file', async () => {
    const rawExternalEml = [
      'From: User <user@local>',
      'To: Agent <agent@local>',
      'Subject: External Note From Notepad',
      'Date: Wed, 21 Oct 2026 12:00:00 GMT',
      'Message-ID: <ext-note-001@vault.local>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Created externally via text editor.',
    ].join('\r\n');

    vi.spyOn(desktopStore, 'readVaultFile').mockResolvedValue(rawExternalEml);

    await vaultStore.handleExternalFsChanges([
      {
        fileName: 'ext_note_001.eml',
        path: '/mock/vault/ext_note_001.eml',
        kind: 'modify',
      },
    ]);

    const node = vaultStore.getNode('<ext-note-001@vault.local>');
    expect(node).toBeDefined();
    expect(node?.subject).toBe('External Note From Notepad');
    expect(node?.fileName).toBe('ext_note_001.eml');
  });

  it('updates an existing capsule when modified externally', async () => {
    const updatedEml = [
      'From: User <user@local>',
      'To: Agent <agent@local>',
      'Subject: External Note Renamed',
      'Date: Wed, 21 Oct 2026 12:05:00 GMT',
      'Message-ID: <ext-note-001@vault.local>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Updated externally via Syncthing.',
    ].join('\r\n');

    vi.spyOn(desktopStore, 'readVaultFile').mockResolvedValue(updatedEml);

    await vaultStore.handleExternalFsChanges([
      {
        fileName: 'ext_note_001.eml',
        path: '/mock/vault/ext_note_001.eml',
        kind: 'modify',
      },
    ]);

    const node = vaultStore.getNode('<ext-note-001@vault.local>');
    expect(node?.subject).toBe('External Note Renamed');
  });

  it('self-write loop guard skips parsing when content matches synced cache', async () => {
    const readSpy = vi.spyOn(desktopStore, 'readVaultFile').mockResolvedValue(
      // Same content as in the previous test
      [
        'From: User <user@local>',
        'To: Agent <agent@local>',
        'Subject: External Note Renamed',
        'Date: Wed, 21 Oct 2026 12:05:00 GMT',
        'Message-ID: <ext-note-001@vault.local>',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Updated externally via Syncthing.',
      ].join('\r\n')
    );

    const rebuildSpy = vi.spyOn(vaultStore, 'rebuildIndexes');

    // Trigger change with byte-identical content (simulating app's own write echoing back)
    await vaultStore.handleExternalFsChanges([
      {
        fileName: 'ext_note_001.eml',
        path: '/mock/vault/ext_note_001.eml',
        kind: 'modify',
      },
    ]);

    expect(readSpy).toHaveBeenCalled();
    // Since cache matches, rebuildIndexes shouldn't be triggered again
    expect(rebuildSpy).not.toHaveBeenCalled();
  });

  it('removes capsule when an .eml file is deleted externally', async () => {
    expect(vaultStore.getNode('<ext-note-001@vault.local>')).toBeDefined();

    await vaultStore.handleExternalFsChanges([
      {
        fileName: 'ext_note_001.eml',
        path: '/mock/vault/ext_note_001.eml',
        kind: 'remove',
      },
    ]);

    expect(vaultStore.getNode('<ext-note-001@vault.local>')).toBeUndefined();
  });

  it('batches rapid filesystem events into a single index rebuild', async () => {
    const handleSpy = vi.spyOn(vaultStore, 'handleExternalFsChanges').mockResolvedValue();

    vaultStore.queueExternalFsChanges([
      { fileName: 'a.eml', path: '/v/a.eml', kind: 'modify' },
    ]);
    vaultStore.queueExternalFsChanges([
      { fileName: 'b.eml', path: '/v/b.eml', kind: 'modify' },
    ]);
    vaultStore.queueExternalFsChanges([
      { fileName: 'c.eml', path: '/v/c.eml', kind: 'modify' },
    ]);

    expect(handleSpy).not.toHaveBeenCalled();

    // Fast-forward debounce timer (100ms)
    vi.advanceTimersByTime(150);

    expect(handleSpy).toHaveBeenCalledTimes(1);
    const passedBatch = handleSpy.mock.calls[0][0];
    expect(passedBatch).toHaveLength(3);
    expect(passedBatch.map((p: any) => p.fileName)).toEqual(['a.eml', 'b.eml', 'c.eml']);
  });
});
