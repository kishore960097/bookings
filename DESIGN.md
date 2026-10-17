# Signal Red on White Glass — iOS-Grade Visual Specification

Theme "Signal Red on White Glass" with iPhone-style polish.
Customer side: warm, fast, red leads the primary action. Owner and admin side: calm and neutral, red only for the single primary action, the LIVE queue and active nav.

## Palette (The ONLY Allowed Colors)
- **Canvas**: `#FFFFFF` (var(--q-canvas))
- **Canvas Soft**: `#F7F7F8` (var(--q-canvas-soft))
- **Ink**: `#171717` (var(--q-ink))
- **Body**: `#4A4A4F` (var(--q-body))
- **Muted**: `#6B7280` (var(--q-muted))
- **Hairline**: `rgba(23, 23, 23, 0.10)` (var(--q-hairline))
- **Red (Brand/Icon/Indicator)**: `#E8342A` (var(--q-red))
- **Red Action (Buttons with white text, 4.9:1)**: `#D62E28` (var(--q-red-action))
- **Red Pressed (Pressed state, red text)**: `#A81818` (var(--q-red-pressed))
- **Red Wash (Tinted ambient backgrounds)**: `#FFF1F0` (var(--q-red-wash))
- **Success**: `#16845B` (var(--q-success))
- **Warning**: `#B26A00` (var(--q-warning))
- **Info**: `#2F5BEA` (var(--q-info))
- **Error**: `#B3261E` (var(--q-error))

## iPhone-Style Visual Language
- **Typography**: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', 'Noto Sans Tamil', system-ui, sans-serif`. Tabular numerals for tokens and prices. Sentence case, no decorative letter-spacing.
- **Corner Radius Scale**:
  - `8px`: inputs, chips
  - `14px`: cards
  - `20px`: sheets, modals, dock
  - `999px`: pills, primary buttons
- **Surfaces**:
  - List cards are solid white with 1px hairline border and soft shadow: `0 1px 2px rgba(23,23,23,0.06), 0 8px 24px rgba(23,23,23,0.06)`.
- **Glass (Floating Layers Only)**:
  - **Frosted**: `rgba(255, 255, 255, 0.72)`, `backdrop-filter: blur(24px) saturate(180%)`, border `1px rgba(255, 255, 255, 0.65)` with hairline outer ring.
  - **Clear**: `rgba(255, 255, 255, 0.45)`, `backdrop-filter: blur(12px)`.
  - **Scrim**: `rgba(23, 23, 23, 0.28)`, `backdrop-filter: blur(8px)`.
  - Fallbacks: solid `#FFFFFF` under `@supports not (backdrop-filter)` and `prefers-reduced-transparency`.
- **Ambient Layer**:
  - Fixed, pointer-events none, aria-hidden div with soft blurred red-wash radial gradients.
- **Press Feedback**:
  - `:active` opacity 0.85 or scale(0.98), 120ms ease-out.
- **Transitions**:
  - `cubic-bezier(0.32, 0.72, 0, 1)`, 250ms–350ms, with `prefers-reduced-motion` override.
