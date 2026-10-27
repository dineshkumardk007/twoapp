import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DialogHost } from './components/DialogHost';
import { isAndroidApp } from './core/platform';
import { applyAppearance, watchPhoneAppearance } from './core/appearance';
import { watchKeyboard } from './core/keyboard';
import './index.css';
import './styles/night.css';

// Inside the Android app, and on a touch phone, the page should behave like
// an app rather than a document: no long-press text selection on buttons and
// labels, and no scroll bars (index.css, under `html.in-app`). Set before the
// first render so it is never briefly the other way. A computer's browser is
// left alone, where selecting any text and dragging a scroll bar is what
// people expect.
try {
  const touchPhone = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
  if (isAndroidApp() || touchPhone) {
    document.documentElement.classList.add('in-app');
    // The same phones are the ones with a keyboard that comes up from below,
    // and the chats let the dock give way to it. A computer's window made
    // shorter while typing is not a keyboard, and moves nothing.
    watchKeyboard();
  }
} catch {
  // Without the class the page simply keeps normal selection.
}

// Night or day - already set by index.html before the first paint; this also
// tells the phone which colour its status bar icons should be.
applyAppearance();
watchPhoneAppearance();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {/* Beside the app, not inside it: the lock screen and the welcome
        screens replace the app's whole tree, and still ask questions. */}
    <DialogHost />
  </React.StrictMode>
);
