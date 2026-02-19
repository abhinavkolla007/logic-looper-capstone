// eslint-disable-next-line no-undef
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bluestock: {
          dark: '#222222',
          blue: '#414BEA',
          lightblue: '#D9E2FF',
          orange: '#F05537',
          gray: '#F6F5F5',
          white: '#FFFFFF',
          purple: '#7752FE',
          navy: '#190482',
          sky: '#DDF2FD',
          pale: '#C2D9FF',
          charcoal: '#3D3B40',
          indigo: '#525CEB',
          silver: '#BFCFE7',
          lilac: '#F8EDFF',
        },
        // ...existing code...
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        opensans: ['Open Sans', 'sans-serif'],
        // ...existing code...
      },
      animation: {
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-pop': 'scalePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scalePop: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
