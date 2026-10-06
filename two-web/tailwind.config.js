/**
 * Motion, and the handful of class names the views borrow from Tailwind 4.
 *
 * The screens were written with Tailwind 4 names - shadow-xs, outline-hidden,
 * backdrop-blur-xs, `animate-in fade-in zoom-in-95` - but the project runs
 * Tailwind 3, which drops a class it does not know without a word. So every
 * card was a flat box with a hairline, every popup snapped open with no fade,
 * and the dimmed backdrop behind it was not blurred. Rather than rewrite a
 * few hundred class lists, this teaches Tailwind 3 the names the views
 * already use.
 *
 * The enter/exit family follows tailwindcss-animate: `animate-in` runs one
 * shared keyframe, and the modifier classes (fade-in, zoom-in-95,
 * slide-in-from-top-4 ...) each set one CSS variable that keyframe reads, so
 * they combine freely. `duration-*` and `delay-*` time these animations as
 * well as transitions, which is what `animate-in fade-in duration-300`
 * expects. They reach only the animations defined here: Tailwind's own
 * animate-pulse and animate-ping keep their speed, so a breathing ring that
 * has `duration-1000` for its grow-and-shrink does not start pulsing twice as
 * fast.
 *
 * Movement uses the separate translate and scale properties rather than
 * transform. A toast centred with `-translate-x-1/2` already owns transform;
 * animating transform as well would knock it off centre while it slid in.
 * The two properties stack instead, so the toast slides straight down.
 *
 * With "reduce motion" switched on in the phone's settings, things still fade
 * so a popup does not appear out of nowhere, but nothing slides, grows or
 * spins.
 *
 * A plain function rather than tailwindcss/plugin's wrapper, which Tailwind 3
 * accepts just the same and which keeps this file free of imports.
 */
function twoMotion({ addBase, addUtilities, matchUtilities, theme }) {
  // About 200ms with a soft ease-out: quick enough that nothing waits on it,
  // slow enough to read as the popup arriving rather than blinking on.
  const enterEase = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  addBase({
    '@keyframes two-enter': {
      from: {
        opacity: 'var(--tw-enter-opacity, 1)',
        translate: 'var(--tw-enter-translate-x, 0) var(--tw-enter-translate-y, 0)',
        scale: 'var(--tw-enter-scale, 1)',
        rotate: 'var(--tw-enter-rotate, 0deg)',
      },
    },
    '@keyframes two-exit': {
      to: {
        opacity: 'var(--tw-exit-opacity, 1)',
        translate: 'var(--tw-exit-translate-x, 0) var(--tw-exit-translate-y, 0)',
        scale: 'var(--tw-exit-scale, 1)',
        rotate: 'var(--tw-exit-rotate, 0deg)',
      },
    },
    // The reduced-motion versions: the same fades, no movement.
    '@keyframes two-enter-fade': {
      from: { opacity: 'var(--tw-enter-opacity, 1)' },
    },
    '@keyframes two-exit-fade': {
      to: { opacity: 'var(--tw-exit-opacity, 1)' },
    },
    '@keyframes two-fade-in': {
      from: { opacity: '0' },
      to: { opacity: '1' },
    },
    '@keyframes two-scale-up': {
      from: { opacity: '0', scale: '0.96' },
      to: { opacity: '1', scale: '1' },
    },
    '@keyframes two-spin': {
      to: { rotate: '360deg' },
    },
  });

  // Timing comes through two variables that duration-* and delay-* set (see
  // the end of this plugin). Each animation resets them, so a `duration-300`
  // on some parent's transition cannot leak down and slow a child's entrance.
  const timing = (fallback) => ({
    'animation-duration': `var(--tw-animation-duration, ${fallback})`,
    'animation-delay': 'var(--tw-animation-delay, 0s)',
    '--tw-animation-duration': 'initial',
    '--tw-animation-delay': 'initial',
  });

  // Registered before the modifiers and durations below so that, at equal
  // specificity, `fade-in` and `duration-300` come later in the stylesheet
  // and win. The `initial` resets stop a modifier on a parent leaking into a
  // child through CSS variable inheritance.
  addUtilities({
    '.animate-in': {
      'animation-name': 'two-enter',
      ...timing('200ms'),
      'animation-timing-function': enterEase,
      // Holds the starting frame through any delay, so a staggered item is
      // not visible at full size before its turn.
      'animation-fill-mode': 'backwards',
      '--tw-enter-opacity': 'initial',
      '--tw-enter-scale': 'initial',
      '--tw-enter-rotate': 'initial',
      '--tw-enter-translate-x': 'initial',
      '--tw-enter-translate-y': 'initial',
      '@media (prefers-reduced-motion: reduce)': {
        'animation-name': 'two-enter-fade',
      },
    },
    '.animate-out': {
      'animation-name': 'two-exit',
      ...timing('150ms'),
      'animation-timing-function': 'ease-in',
      // Stays gone until the element is removed, instead of flashing back for
      // a frame when the animation ends.
      'animation-fill-mode': 'forwards',
      '--tw-exit-opacity': 'initial',
      '--tw-exit-scale': 'initial',
      '--tw-exit-rotate': 'initial',
      '--tw-exit-translate-x': 'initial',
      '--tw-exit-translate-y': 'initial',
      '@media (prefers-reduced-motion: reduce)': {
        'animation-name': 'two-exit-fade',
      },
    },

    // Self-contained ones the views also use.
    '.animate-fade-in': {
      'animation-name': 'two-fade-in',
      ...timing('200ms'),
      'animation-timing-function': enterEase,
      'animation-fill-mode': 'backwards',
    },
    '.animate-scale-up': {
      'animation-name': 'two-scale-up',
      ...timing('220ms'),
      'animation-timing-function': enterEase,
      'animation-fill-mode': 'backwards',
      '@media (prefers-reduced-motion: reduce)': {
        'animation-name': 'two-fade-in',
      },
    },
    '.animate-spin-slow': {
      animation: 'two-spin 6s linear infinite',
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
      },
    },
  });

  const withoutDefault = (values) => {
    const { DEFAULT, ...rest } = values;
    return rest;
  };
  const negate = (value) => (value.startsWith('-') ? value.slice(1) : `-${value}`);

  // Bare `fade-in` starts from transparent; `fade-in-50` from half.
  matchUtilities(
    {
      'fade-in': (value) => ({ '--tw-enter-opacity': value }),
      'fade-out': (value) => ({ '--tw-exit-opacity': value }),
    },
    { values: { DEFAULT: '0', ...theme('opacity') } }
  );

  // `zoom-in-95` grows from 95% of full size.
  matchUtilities(
    {
      'zoom-in': (value) => ({ '--tw-enter-scale': value }),
      'zoom-out': (value) => ({ '--tw-exit-scale': value }),
    },
    { values: { DEFAULT: '0', ...theme('scale') } }
  );

  matchUtilities(
    {
      'spin-in': (value) => ({ '--tw-enter-rotate': value }),
      'spin-out': (value) => ({ '--tw-exit-rotate': value }),
    },
    { values: { DEFAULT: '30deg', ...theme('rotate') } }
  );

  // `slide-in-from-top-4` starts 1rem above where it ends up.
  matchUtilities(
    {
      'slide-in-from-top': (value) => ({ '--tw-enter-translate-y': negate(value) }),
      'slide-in-from-bottom': (value) => ({ '--tw-enter-translate-y': value }),
      'slide-in-from-left': (value) => ({ '--tw-enter-translate-x': negate(value) }),
      'slide-in-from-right': (value) => ({ '--tw-enter-translate-x': value }),
      'slide-out-to-top': (value) => ({ '--tw-exit-translate-y': negate(value) }),
      'slide-out-to-bottom': (value) => ({ '--tw-exit-translate-y': value }),
      'slide-out-to-left': (value) => ({ '--tw-exit-translate-x': negate(value) }),
      'slide-out-to-right': (value) => ({ '--tw-exit-translate-x': value }),
    },
    { values: { DEFAULT: '100%', ...theme('translate') } }
  );

  // Tailwind's own duration-* and delay-* still set the transition timing;
  // these add the timing for the animations above to the same class names.
  matchUtilities(
    { duration: (value) => ({ '--tw-animation-duration': value }) },
    { values: withoutDefault(theme('transitionDuration')) }
  );
  matchUtilities(
    { delay: (value) => ({ '--tw-animation-delay': value }) },
    { values: withoutDefault(theme('transitionDelay')) }
  );

  addUtilities({
    // Tailwind 4's name for what Tailwind 3 calls outline-none: no visible
    // outline, but a transparent one that forced-colours (high contrast) mode
    // can still paint, so keyboard focus is never lost there.
    '.outline-hidden': {
      outline: '2px solid transparent',
      'outline-offset': '2px',
    },
    // Rows of chips that scroll sideways. A phone has no pointer to drag a
    // scrollbar with, and the track would only eat into the row.
    '.scrollbar-none': {
      'scrollbar-width': 'none',
      '-ms-overflow-style': 'none',
      '&::-webkit-scrollbar': { display: 'none' },
    },
  });
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        linen: {
          bg: '#FAF8F5',
          surface: '#FFFFFF',
          variant: '#F2EFEB',
          primary: '#2D312E',
          secondary: '#72685F',
          accent: '#B07D62',
          border: '#E8E4DF',
        },
        slate: {
          bg: '#121518',
          surface: '#1B1F24',
          variant: '#242930',
          primary: '#E8ECEF',
          secondary: '#8E98A4',
          accent: '#7EA8BE',
          border: '#2D343E',
        },
        forest: {
          bg: '#F4F6F4',
          surface: '#FFFFFF',
          variant: '#EAEFEA',
          primary: '#2C3E35',
          secondary: '#5E7367',
          accent: '#588157',
          border: '#D8E2D8',
        },
        terracotta: {
          bg: '#FBF7F4',
          surface: '#FFFFFF',
          variant: '#F4ECE6',
          primary: '#382923',
          secondary: '#7D6055',
          accent: '#C86D51',
          border: '#EADCD3',
        },
        gold: {
          50: '#FBF7EE',
          100: '#F5EACB',
          500: '#DDA15E',
          600: '#E0A96D',
        }
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },

      // Card depth. Low and warm: tinted with the linen ink (#2D312E) rather
      // than pure black, so a card on the cream background looks lifted, not
      // smudged. shadow-xs is the everyday card; shadow-2xs a hairline under
      // small chips and icon tiles.
      boxShadow: {
        '2xs': '0 1px 0 0 rgb(45 49 46 / 0.05)',
        xs: '0 1px 2px 0 rgb(45 49 46 / 0.05), 0 2px 8px -3px rgb(45 49 46 / 0.08)',
      },
      dropShadow: {
        xs: '0 1px 1px rgb(45 49 46 / 0.08)',
      },
      // The faint frosting behind a popup: enough to soften the page, not so
      // much that it reads as a different screen. Tailwind 4 uses 4px.
      blur: {
        xs: '4px',
      },
      backdropBlur: {
        xs: '4px',
      },

      // Tailwind 4 accepts any number in these; Tailwind 3 only knows its
      // fixed steps, so the ones the views use are listed.
      scale: {
        98: '0.98',
        102: '1.02',
        115: '1.15',
        120: '1.2',
        200: '2',
        250: '2.5',
      },
      spacing: {
        68: '17rem',
      },
      aspectRatio: {
        '4/3': '4 / 3',
      },
      // Named rather than written as duration-[250ms]: an arbitrary value
      // matches both Tailwind's duration and the animation timing above,
      // and an ambiguous class produces no CSS at all.
      transitionDuration: {
        250: '250ms',
        400: '400ms',
        1500: '1500ms',
      },
      // Tailwind 4's bg-radial, fed by the usual from-/via-/to- stops.
      backgroundImage: {
        radial: 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [twoMotion],
}
