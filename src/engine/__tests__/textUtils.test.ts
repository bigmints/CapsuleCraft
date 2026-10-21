import { describe, it, expect } from 'vitest';
import { shouldOpenSlashMenu } from '../textUtils';

describe('shouldOpenSlashMenu', () => {
  it('opens at the start of the text', () => {
    expect(shouldOpenSlashMenu('', 0)).toBe(true);
  });

  it('opens after whitespace or newline', () => {
    expect(shouldOpenSlashMenu('say ', 4)).toBe(true);
    expect(shouldOpenSlashMenu('line\n', 5)).toBe(true);
    expect(shouldOpenSlashMenu('tab\t', 4)).toBe(true);
  });

  it('never opens mid-word (and/or, dates, urls)', () => {
    expect(shouldOpenSlashMenu('and', 3)).toBe(false);
    expect(shouldOpenSlashMenu('10', 2)).toBe(false);
    expect(shouldOpenSlashMenu('https://', 8)).toBe(false);
  });
});
