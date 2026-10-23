# Monitoring Page Overrides

> **PROJECT:** Attobrain
> **Generated:** 2026-10-22 22:17:16
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1400px or full-width
- **Grid:** 12-column grid for data flexibility

### Spacing Overrides

- **Content Density:** High — optimize for information display

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- No overrides — use Master colors

### Component Overrides

- Avoid: Icon buttons without labels
- Avoid: Keyboard traps or illogical tab order
- Avoid: Single row actions only

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Real-time chart animations, alert pulse/glow, status indicator blink animation, smooth data stream updates, loading effect
- Accessibility: Add aria-label for icon-only buttons
- Accessibility: Tab order matches visual order
- Data Entry: Allow multi-select and bulk edit

## Decisões aplicadas na Attobrain

Preservar a marca existente: violeta #6941C6, teal #087F73, superfícies brancas e fundo #F6F7FB. A paleta azul sugerida pelo catálogo não substitui a identidade oficial. Manter a fonte local Segoe UI/Manrope, sem chamadas externas. Usar números tabulares e títulos sem fonte de código.

Hierarquia: título → etapa → seis indicadores → controles → gráficos observados/sintéticos (coluna principal) → prévia compacta e eventos (coluna lateral). Configuração e detalhes são progressivos. Sem valores inventados em estados vazios. Sinal sintético identificado em todos os estados. Sem animações piscantes ou cores que sugiram gravidade clínica.

Tela do aluno: uma tarefa por vez, instrução curta, espera com logo oficial e movimento suave desativado por prefers-reduced-motion. Não recebe métricas ou EEG. Respeitar 375/768/1024/1440 px e controles por teclado.

Escopo técnico: HTML/CSS/ES modules existentes; sem framework ou dependências novas. Riscos principais: preservar IDs e estados dos controles, não conectar trajetória através de pausas e não reduzir o labirinto do aluno ao compactar a prévia profissional. Verificação: testes existentes + projeções de interface/traçado + inspeção das duas telas e quatro larguras.
