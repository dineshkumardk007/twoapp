import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { isAndroidApp } from './core/platform';
import './index.css';

// Inside the Android app, and on a touch phone, the page should behave like
// an app rather than a document: no long-press text selection on buttons and
// labels (index.css, under `html.in-app`). Set before the first render so it
// is never briefly the other way. A computer's browser is left alone, where
// selecting any text is what people expect.
try {
  const touchPhone = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
  if (isAndroidApp() || touchPhone) {
    document.documentElement.classList.add('in-app');
  }
} catch {
  // Without the class the page simply keeps normal selection.
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
