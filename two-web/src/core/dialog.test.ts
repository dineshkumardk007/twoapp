import { describe, it, expect, afterEach } from 'vitest';
import { askConfirm, showNotice, currentDialog, answerDialog, subscribeDialogs } from './dialog';
import { handleBack, pushBackLayer } from './backStack';

// Anything a test leaves open is answered, so the next starts with nothing on screen.
afterEach(() => {
  while (currentDialog()) answerDialog(false);
});

describe('The app\'s own confirm and notice pop-ups', () => {
  it('answers yes only for the go-ahead', async () => {
    const asked = askConfirm({ title: 'Clear the drawing board?', confirm: 'Clear it', danger: true });
    const shown = currentDialog();
    expect(shown).toMatchObject({ kind: 'confirm', title: 'Clear the drawing board?', confirmLabel: 'Clear it', cancelLabel: 'Cancel', danger: true });
    answerDialog(true);
    expect(await asked).toBe(true);
    expect(currentDialog()).toBeNull();
  });

  it('answers no for Cancel', async () => {
    const asked = askConfirm({ title: 'Leave the group?' });
    answerDialog(false);
    expect(await asked).toBe(false);
  });

  it('shows one at a time, in the order they were asked', async () => {
    const first = askConfirm({ title: 'First' });
    const second = showNotice({ title: 'Second', ok: 'Got it' });
    expect(currentDialog()?.title).toBe('First');
    answerDialog(true);
    expect(await first).toBe(true);
    expect(currentDialog()).toMatchObject({ kind: 'notice', title: 'Second', confirmLabel: 'Got it' });
    answerDialog(true);
    await expect(second).resolves.toBeUndefined();
    expect(currentDialog()).toBeNull();
  });

  it('tells whoever is drawing them when one opens or closes', () => {
    let calls = 0;
    const stop = subscribeDialogs(() => calls++);
    void askConfirm({ title: 'Disconnect?' });
    answerDialog(false);
    stop();
    void askConfirm({ title: 'Not heard' });
    expect(calls).toBe(2);
  });

  it('counts the phone\'s Back as no, like the host registers it', async () => {
    const asked = askConfirm({ title: 'Start fresh?', danger: true });
    // What DialogHost does while a dialog is up.
    pushBackLayer(() => answerDialog(false));
    expect(handleBack()).toBe(true);
    expect(await asked).toBe(false);
  });
});
