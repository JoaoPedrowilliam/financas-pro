import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1440px' } },
    extend: {
      colors: {
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          muted: 'hsl(var(--ink-muted))',
          faint: 'hsl(var(--ink-faint))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          raised: 'hsl(var(--surface-raised))',
          sunken: 'hsl(var(--surface-sunken))',
          /** Um degrau abaixo dos cards: separa a navegação do conteúdo sem borda pesada. */
          sidebar: 'hsl(var(--surface-sidebar))',
        },
        line: {
          DEFAULT: 'hsl(var(--line))',
          strong: 'hsl(var(--line-strong))',
        },
        cedula: {
          DEFAULT: 'hsl(var(--cedula))',
          soft: 'hsl(var(--cedula-soft))',
          ink: 'hsl(var(--cedula-ink))',
          /** Cor do texto POR CIMA do verde. Muda por tema — nunca 'white' fixo. */
          fg: 'hsl(var(--cedula-fg))',
        },
        aco: { DEFAULT: 'hsl(var(--aco))', soft: 'hsl(var(--aco-soft))' },
        ambar: { DEFAULT: 'hsl(var(--ambar))', soft: 'hsl(var(--ambar-soft))' },
        coral: {
          DEFAULT: 'hsl(var(--coral))',
          soft: 'hsl(var(--coral-soft))',
          fg: 'hsl(var(--coral-fg))',
          /* Só o botão destrutivo usa este passo: o vermelho de sinalização é claro demais para carregar texto branco. */
          strong: 'hsl(var(--coral-strong))',
        },
        violeta: { DEFAULT: 'hsl(var(--violeta))', soft: 'hsl(var(--violeta-soft))' },
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
      },
      fontSize: {
        // Escala tipográfica (razão ~1.25)
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        cifra: ['2.75rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'cifra-lg': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.035em' }],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
        pill: '999px',
      },
      boxShadow: {
        raised: 'var(--shadow-raised)',
        float: 'var(--shadow-float)',
      },
      keyframes: {
        'slide-down': { from: { height: '0' }, to: { height: 'var(--radix-collapsible-content-height)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 240ms ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
