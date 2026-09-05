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
      }
    },
  },
  plugins: [],
}
