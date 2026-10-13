import { describe, it, expect } from 'vitest';
import {
  backupNudge,
  recordBackup,
  snoozeBackupNudge,
  requestBackupOnOpen,
  takeBackupRequest,
  FIRST_NUDGE_DAYS,
  BACKUP_EVERY_DAYS,
  SNOOZE_DAYS
} from './backupReminder';

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1, 9, 0, 0);

describe('Asking for a backup now and then', () => {
  it('waits a week before asking someone who has never backed up', () => {
    expect(backupNudge(START)).toBeNull();
    expect(backupNudge(START + (FIRST_NUDGE_DAYS - 1) * DAY)).toBeNull();
    expect(backupNudge(START + FIRST_NUDGE_DAYS * DAY)).toEqual({ everBackedUp: false, daysSince: 0 });
  });

  it('after a backup, asks again only a month later', () => {
    backupNudge(START);
    recordBackup(START + 2 * DAY);
    expect(backupNudge(START + 20 * DAY)).toBeNull();
    expect(backupNudge(START + 2 * DAY + (BACKUP_EVERY_DAYS - 1) * DAY)).toBeNull();
    expect(backupNudge(START + 2 * DAY + 31 * DAY)).toEqual({ everBackedUp: true, daysSince: 31 });
  });

  it('keeps quiet for a week after Later', () => {
    backupNudge(START);
    const due = START + FIRST_NUDGE_DAYS * DAY;
    snoozeBackupNudge(due);
    expect(backupNudge(due + DAY)).toBeNull();
    expect(backupNudge(due + SNOOZE_DAYS * DAY)).not.toBeNull();
  });

  it('a backup clears a snooze', () => {
    backupNudge(START);
    snoozeBackupNudge(START);
    recordBackup(START + DAY);
    expect(backupNudge(START + DAY + BACKUP_EVERY_DAYS * DAY)).not.toBeNull();
  });

  it('opens the backup pop-up in Settings once, when Home asked for it', () => {
    expect(takeBackupRequest()).toBe(false);
    requestBackupOnOpen();
    expect(takeBackupRequest()).toBe(true);
    expect(takeBackupRequest()).toBe(false);
  });
});
