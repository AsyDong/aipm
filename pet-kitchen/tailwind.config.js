/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sky: {
          50: '#F2FAFF',
          100: '#DFF3FF',
          200: '#BEE8FF',
          300: '#8FD9FB',
          400: '#5CC4F2',
          500: '#33ACE4',
          600: '#1E8BC4',
        },
        cream: '#FFFBF2',
        ink: '#2F3B4C',
        muted: '#7C8BA1',
        food: '#F6A23C',
        point: '#FFC94D',
        hp: '#FF6B6B',
        ok: '#4CD08A',
        warn: '#FFB020',
        danger: '#FF6B6B',
      },
      fontFamily: {
        round: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 16px rgba(51, 121, 168, 0.10)',
        pop: '0 8px 28px rgba(51, 121, 168, 0.20)',
      },
      borderRadius: {
        xl2: '20px',
        xl3: '28px',
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        popin: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%,100%': { transform: 'rotate(-6deg)' },
          '50%': { transform: 'rotate(6deg)' },
        },
        slideup: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        toastin: {
          from: { transform: 'translateY(-24px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        jump: {
          '0%,100%': { transform: 'translateY(0) scale(1,1)' },
          '30%': { transform: 'translateY(-10px) scale(0.96,1.06)' },
        },
      },
      animation: {
        floaty: 'floaty 2.6s ease-in-out infinite',
        popin: 'popin 0.42s cubic-bezier(.2,1.4,.4,1)',
        shake: 'shake 0.36s ease-in-out infinite',
        slideup: 'slideup 0.28s ease-out',
        toastin: 'toastin 0.24s ease-out',
        jump: 'jump 0.5s ease-in-out',
      },
    },
  },
  plugins: [],
}
