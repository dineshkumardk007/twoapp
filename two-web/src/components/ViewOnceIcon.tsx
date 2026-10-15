import React from 'react';

/** The view-once mark: a 1 inside a broken circle, in the colour of the words around it. */
export const ViewOnceIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="10" strokeDasharray="4 2.2" />
    <path d="M10.5 9.5 12.5 8v8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
