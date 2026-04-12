# Design System Strategy: The Kinetic Void

## 1. Overview & Creative North Star
The North Star for this design system is **"The Kinetic Void."** 

In the chaotic environment of urban mobility, this system acts as a sophisticated, silent navigator. We are moving beyond the "utility app" aesthetic to create a high-end digital concierge. By utilizing a deep obsidian foundation, we allow the UI to recede, making the critical data—parking availability and navigation—feel like glowing holograms floating in a dark, premium space.

To break the "template" look, we utilize **intentional asymmetry**. Primary actions are not always centered; they are weighted to suggest movement. We use **overlapping glass layers** and a high-contrast typography scale to create an editorial feel that is more "Luxury Automotive Dashboard" and less "Generic SaaS."

---

## 2. Colors & Tonal Depth

### The Palette
The core of the system is built on deep blacks and vibrant, neon-functional accents.
- **Primary (Electric Purple):** `#e08efe` — Used for high-level brand moments and active navigation.
- **Secondary (Neon Green):** `#80f9c8` — Reserved exclusively for "Available" states and success confirmations.
- **Tertiary (Amber):** `#ffd16f` — Denotes "Occupied" or "Limited" status.
- **Background/Surface:** `#0e0e0e` — The "Obsidian" base.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Traditional dividers are forbidden. Boundaries must be defined through:
1.  **Background Color Shifts:** A `surface-container-low` (#131313) card sitting on a `surface` (#0e0e0e) background.
2.  **Negative Space:** Using the `8` (2rem) or `10` (2.5rem) spacing tokens to create structural breathing room.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each "inner" container should move up the hierarchy:
*   **Base Level:** `surface` (#0e0e0e)
*   **Section Level:** `surface-container-low` (#131313)
*   **Interactive Cards:** `surface-container-highest` (#262626)

### The "Glass & Gradient" Rule
To achieve a signature look, utilize **Glassmorphism** for floating elements (like a bottom navigation bar or a sticky map header). Use semi-transparent surface colors with a `20px` to `40px` backdrop-blur. 
*   **Signature Texture:** Apply a subtle linear gradient to main CTAs (from `primary` to `primary-container`) to give buttons a "luminous" quality rather than a flat fill.

---

## 3. Typography
We use a dual-font strategy to balance high-tech precision with extreme readability.

*   **Display & Headlines (Space Grotesk):** This is our "Editorial" voice. It’s slightly wide, futuristic, and commanding. 
    *   *Usage:* Use `display-lg` (3.5rem) for vacant spot counts and `headline-md` (1.75rem) for location names.
*   **Body & Labels (Inter):** Our "Functional" voice. Highly legible at small scales.
    *   *Usage:* All UI metadata, durations, and instructions.

The contrast between the expressive Space Grotesk and the neutral Inter creates a "Command Center" aesthetic that feels both premium and professional.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Layering**. Instead of drop shadows, place a `surface-container-lowest` (#000000) element inside a `surface-container-high` (#201f1f) area to create a "recessed" or "inset" look. This mimics machined hardware.

### Ambient Shadows
If an element must "float" (e.g., a modal), use an **Ambient Shadow**:
*   **Blur:** 40px - 60px
*   **Opacity:** 6%
*   **Color:** `#e08efe` (Primary tint) — This mimics the neon glow of the UI hitting the dark surface.

### The "Ghost Border" Fallback
If a container requires a boundary for accessibility (e.g., an input field), use the **Ghost Border**:
*   **Token:** `outline-variant` (#484847)
*   **Opacity:** 15%
*   **Weight:** 1px

---

## 5. Components

### Buttons (The "Luminous" CTA)
*   **Primary:** Fill with `primary` gradient. `xl` (1.5rem) corner radius. On hover, apply a `primary` outer glow (4px spread).
*   **Secondary:** Ghost style. `outline` token at 20% opacity with `primary` text.
*   **Tertiary:** Text-only using `label-md`.

### Parking Slot Chips
*   **Available:** `secondary-container` background with `on-secondary-container` text.
*   **Occupied:** `surface-variant` background with `on-surface-variant` text (muted).

### Input Fields
*   **Base:** `surface-container-highest` fill. No border.
*   **Active State:** 1px border using `primary` and a subtle inner glow.
*   **Radius:** `md` (0.75rem).

### Cards & Lists (The "Border-Free" List)
*   **Rule:** Forbid divider lines. 
*   **Implementation:** Use `surface-container-low` for the list container. Each list item should be separated by `2` (0.5rem) of vertical white space or a subtle shift to `surface-container-high` on hover.

### Relevant Custom Components:
*   **The "Availability Pulse":** A small, circular indicator using `secondary` with a CSS pulse animation to show real-time slot heartbeat.
*   **The "Obsidian Map Overlay":** A bottom sheet with `xl` (1.5rem) radius using `surface-container` with 80% opacity and a heavy backdrop blur.

---

## 6. Do's and Don'ts

### Do
*   **Do** use extreme scale for numbers (e.g., use `display-lg` for the number of available parking floors).
*   **Do** embrace "True Black" (#000000) for the deepest background layers to save battery on OLED screens.
*   **Do** use `24` (6rem) padding at the top of screens to give the "Editorial" headlines room to breathe.

### Don't
*   **Don't** use standard "Material Design" blue or grey shadows. 
*   **Don't** use sharp 90-degree corners; everything must feel machined and ergonomic (minimum `md` radius).
*   **Don't** use 100% white text for body copy; use `on-surface-variant` (#adaaaa) to reduce eye strain in dark environments.
*   **Don't** crowd the screen. If it feels tight, increase the spacing token by two levels.