# GigGuard Brand Guidelines & Design System

This document outlines the official UI/UX brand guidelines for the GigGuard Admin Dashboard. It serves as the single source of truth for developers translating our mobile aesthetic into a web-based command center. 

## 1. The Core Vibe
**"Security Meets Real-Time Intelligence."**

GigGuard is a premium insurtech platform, not a standard CRUD application. The interface needs to evoke the feeling of a **high-tech security command center or a Bloomberg terminal merged with cyberpunk neon**. 

* **Theme:** Exclusively Dark Mode.
* **Aesthetic:** Glassmorphism, deep space backgrounds, glowing data points, and sharp contrast.
* **Motion & Feel:** Interfaces should feel alive but stable. Micro-animations should be swift and decisive, not bouncy or playful.

---

## 2. Color Palette (The Dark + Neon System)

Our palette uses deep, cool tones to establish authority and trust, punctured by vivid, highly saturated neon accents to draw the eye to critical actions and risks.

### Background & Surface Hierarchy
Use these specifically to build depth (Z-axis) without borders:
* **App Background (`bg`):** `#131323` (Deep Void — pure base layer)
* **Default Card (`bgCard`):** `#1A1A2E` (Surface layer 1)
* **Hovered Card (`bgCardHover`):** `#22223A` (Interactive surface)
* **Elevated Nav/Modals (`bgElevated`):** `#1E1E32` (Z-index 50+)

### Text & Typography Colors
* **Primary (`textPrimary`):** `#FFFFFF` (Headings, primary values)
* **Secondary (`textSecondary`):** `#B0B0C0` (Subtitles, table headers)
* **Muted/Disabled (`textMuted`):** `#6B6B85` (Placeholder text, minor timestamps)

### The Dual Accents
We use two distinct accents for branding. **Aqua** represents technology/tracking, and **Burnt Orange** represents action/premium.
* **Tech Aqua:** `#00E5FF`
  * Light: `#4EEDFF`
  * Glow/Dim: `rgba(0, 229, 255, 0.12)`
* **Burnt Orange/Accent:** `#FF6B35`
  * Light: `#FF8F60`
  * Glow/Dim: `rgba(255, 107, 53, 0.12)`

### Status & Risk Indicators
These must be used strictly for their semantic meaning:
* **Safe / Low Risk / Success:** `#00E676` (Neon Green)
* **Moderate / Warning:** `#FFB300` (Amber)
* **High Risk:** `#FF6B35` (Burnt Orange)
* **Extreme / Danger / Fraud Flag:** `#FF5252` (Crimson)

---

## 3. Typography

For the web, we must ditch standard default fonts and use high-end, geometric modern sans-serifs to look tech-forward.

* **Primary Font Family:** `Inter`, `Outfit`, or `Space Grotesk`. (If using Google Fonts, `Inter` for data tables + `Outfit` for large headings is an excellent pair).
* **Weights:**
  * Base text: `400` (Regular)
  * Values / Labels: `500` (Medium)
  * Headings / Emphasis: `600` (Semi-bold)
  * Big Metric Numbers: `700` or `800` (Heavy)

---

## 4. How We Set the Vibe (UI Effects)

Do not use hard, high-contrast borders for separation. Instead, build the UI using the following effects:

### 1. Subdued Borders
If you must use borders (like on inputs or separating elements), they must be almost invisible:
* **Standard Border:** `1px solid rgba(255, 255, 255, 0.06)`
* **Active/Accent Border:** `1px solid rgba(0, 229, 255, 0.25)`

### 2. Deep Shadows & The "Neon Glow"
Since the background is dark, standard drop shadows don't work. Instead, we use "glows" underneath elevated elements.
* **Card Shadow (Soft Depth):**
  * `box-shadow: 0px 4px 10px rgba(0,0,0,0.35);`
* **Elevated Shadow (Modals/Popovers):** 
  * `box-shadow: 0px 8px 16px rgba(0,0,0,0.45);`
* **The Brand Glow (Active States / Premium Blocks):** 
  * Take the accent color (e.g., `#00E5FF`) and make it glow: `box-shadow: 0px 0px 20px rgba(0, 229, 255, 0.4);`

### 3. Glassmorphism Effects
When placing floating elements (like the Circuit Breaker alert or a sticky header) over complex backgrounds (like maps):
* Set background to `rgba(26, 26, 46, 0.7)`
* Add `backdrop-filter: blur(20px)`

---

## 5. UI Spacing & Border Radii

Keep padding dense enough for a power-user "Dashboard" vibe, but breathable enough to feel premium.
* **Densities:** `4px`, `8px`, `12px`, `16px`. Data grids should use `12px` line heights.
* **Component Rounding:** 
  * Small inputs/tags: `8px`
  * Standard Cards: `16px`
  * Modals or elevated main windows: `24px`

## Final Note for the Designer
If it looks like a standard hospital dashboard or accounting software, you've gone wrong. If it looks like a hacker's HUD or a SpaceX telemetry screen—you are exactly on track. Use the glow effects and deep background hierarchy (`#131323` vs `#1A1A2E`) to guide the user's eye!