# Design System Strategy: Aura Academic (The Digital Curator)

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Curator."** In a complex environment like a University, the system acts as a sophisticated, high-performance lens that organizes, highlights, and facilitates academic and social excellence.

## 2. Visual Foundation (The Hybrid Aesthetic)
The system is a "High-Density ERP + Premium SaaS" hybrid.
- **ERP Side:** Precision, information density, data integrity, and utility.
- **SaaS Side:** Motion, refined typography, depth via shadows/blurs, and user-centric flows.

## 3. Light Mode vs. Dark Mode Specifications

### A. Light Mode (The Pristine Studio)
*Focus: Clarity, energy, and institutional trust.*
- **Primary Surface:** `#FFFFFF` (Pure White)
- **Secondary Surface:** `#F8FAFC` (Slate 50) - Used for background layering.
- **Tertiary Surface:** `#F1F5F9` (Slate 100) - Used for input fields and subtle sectioning.
- **Text (Primary):** `#0F172A` (Slate 900)
- **Text (Secondary):** `#475569` (Slate 600)
- **Primary Accent:** `#0D9488` (Teal 600)
- **Shadows:** Soft, multi-layered shadows using `rgba(15, 23, 42, 0.05)` to create depth without visual noise.

### B. Dark Mode (The Deep Command)
*Focus: Focus, reduced eye strain, and premium technological feel.*
- **Primary Surface:** `#0B1221` (Custom Slate-950 variant)
- **Secondary Surface:** `#0F172A` (Slate 900) - Used for card backgrounds and navigation.
- **Tertiary Surface:** `#1E293B` (Slate 800) - Used for nested elements and borders.
- **Text (Primary):** `#F8FAFC` (Slate 50)
- **Text (Secondary):** `#94A3B8` (Slate 400)
- **Primary Accent:** `#2DD4BF` (Teal 400) - Slightly brighter for better contrast against dark backgrounds.
- **Shadows:** "Glow" based depth using subtle teal highlights `rgba(45, 212, 191, 0.02)` and deeper black shadows.

## 4. Typography (Manrope & Inter)
- **Headings (Manrope):** Strong, professional, and slightly geometric. Used for brand presence and module titles.
- **Data/UI (Inter):** High-legibility sans-serif. Used for tables, forms, and dense information cards.

## 5. Design Tokens & Components
- **Roundness:** `ROUND_EIGHT` (8px) for a modern, approachable feel that maintains professional structure.
- **Borders:** `1px` solid. In Light Mode: `Slate-200`. In Dark Mode: `Slate-800`.
- **Glassmorphism:** Used sparingly for TopNavBars and Modals (`backdrop-blur-xl`) to provide context and layered sophistication.
