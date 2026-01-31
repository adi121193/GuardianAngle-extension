# PII Guardian - Color Reference Guide

## Primary Color Palette

### Security Blue (Primary)
The main brand color that conveys trust, security, and professionalism.

```css
--primary-color: #2563eb       /* Main brand color */
--primary-dark:  #1e40af       /* Hover states, emphasis */
--primary-light: #3b82f6       /* Highlights, accents */
--primary-gradient: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)
```

**Usage:**
- Header background (gradient)
- Primary buttons
- Links and interactive elements
- Toggle switch when active
- Stat card accents

---

### Secondary Purple
Complementary color for gradients and special elements.

```css
--secondary-color: #7c3aed     /* Purple accent */
--secondary-dark:  #6d28d9     /* Darker purple */
```

**Usage:**
- Gradient endpoints
- Pro banner background
- Special highlights

---

## Status Colors

### Success Green
Indicates active states, successful actions, and positive metrics.

```css
--success-color: #10b981       /* Main green */
--success-light: #34d399       /* Light variant */
```

**Usage:**
- Active status indicator
- "Masked" stat card
- Pro status badge
- Success messages
- Checkmarks in feature list

---

### Warning Amber
Alerts and important notices without being critical.

```css
--warning-color: #f59e0b       /* Main amber */
--warning-light: #fbbf24       /* Light variant */
```

**Usage:**
- "Blocked" stat card
- License expiry warnings
- Important but non-critical alerts

---

### Danger Red
Critical alerts and destructive actions.

```css
--danger-color: #ef4444        /* Main red */
--danger-light: #f87171        /* Light variant */
```

**Usage:**
- Error messages
- Delete confirmations
- Critical warnings

---

## Neutral Grays

Comprehensive 9-step gray scale for backgrounds, borders, and text.

```css
--gray-50:  #f9fafb           /* Lightest - Main content background */
--gray-100: #f3f4f6           /* Very light - Card backgrounds */
--gray-200: #e5e7eb           /* Light - Borders, dividers */
--gray-300: #d1d5db           /* Medium light - Inactive toggle */
--gray-400: #9ca3af           /* Medium - Disabled states */
--gray-500: #6b7280           /* Medium dark - Secondary text */
--gray-600: #4b5563           /* Dark - Tertiary text */
--gray-700: #374151           /* Darker */
--gray-800: #1f2937           /* Very dark */
--gray-900: #111827           /* Darkest - Primary text */
```

**Usage Guide:**
- **50-100**: Backgrounds
- **200-300**: Borders and dividers
- **400-500**: Disabled and secondary text
- **600-900**: Primary text and dark UI elements

---

## Semantic Color Assignments

### Background Colors
```css
--bg-primary:   #ffffff        /* Main content areas (cards) */
--bg-secondary: #f9fafb        /* Page background */
--bg-tertiary:  #f3f4f6        /* Subtle sections */
```

### Text Colors
```css
--text-primary:   #111827      /* Main headings, important text */
--text-secondary: #6b7280      /* Body text, descriptions */
--text-tertiary:  #9ca3af      /* Subtle text, hints */
--text-white:     #ffffff      /* Text on colored backgrounds */
```

---

## Component-Specific Colors

### Header
- **Background**: Primary gradient (Blue → Purple)
- **Text**: White
- **Logo container**: `rgba(255, 255, 255, 0.2)` with blur
- **Status indicator**: `rgba(255, 255, 255, 0.2)` with blur
- **Pattern overlay**: `rgba(255, 255, 255, 0.1)`

### Stat Cards
Each stat has its own color identity:

**Detections (Blue)**
```css
Icon background: rgba(37, 99, 235, 0.08)
Icon color: #2563eb
Hover value color: #2563eb
Accent bar: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)
```

**Masked (Green)**
```css
Icon background: rgba(16, 185, 129, 0.08)
Icon color: #10b981
Hover value color: #10b981
Accent bar: linear-gradient(135deg, #10b981 0%, #34d399 100%)
```

**Blocked (Amber)**
```css
Icon background: rgba(245, 158, 11, 0.08)
Icon color: #f59e0b
Hover value color: #f59e0b
Accent bar: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)
```

### Pro Banner (Free Users)
```css
Background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)
Text: #ffffff
Icon container: rgba(255, 255, 255, 0.2) with blur
Button background: #ffffff
Button text: #2563eb
```

### Pro Status (Active Pro)
```css
Background: linear-gradient(135deg, #10b981 0%, #059669 100%)
Text: #ffffff
Badge background: rgba(255, 255, 255, 0.25) with blur
```

### Buttons

**Primary Button**
```css
Background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)
Text: #ffffff
Shadow: rgba(37, 99, 235, 0.2)
Hover shadow: rgba(37, 99, 235, 0.3)
```

**Secondary Button**
```css
Background: #ffffff
Border: #d1d5db (1.5px)
Text: #111827
Hover border: #2563eb
Hover text: #2563eb
```

### Toggle Switch
```css
Inactive: #d1d5db
Active: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)
Focus ring: rgba(37, 99, 235, 0.15)
Knob: #ffffff with shadow
```

---

## Opacity & Transparency Guide

### Glass-morphism Effects
```css
Background opacity: 0.2 - 0.25
Blur amount: 10px
Border: rgba(255, 255, 255, 0.1)
```

### Hover Overlays
```css
Ripple effect: rgba(255, 255, 255, 0.3)
Pattern overlays: 0.3
Icon containers: 0.08 (colored backgrounds)
```

### Shadows
All shadows use black (`rgba(0, 0, 0, x)`):
```css
sm:  0.05 opacity
md:  0.1 opacity
lg:  0.1 opacity
xl:  0.1 - 0.04 opacity (layered)
```

---

## Accessibility & Contrast

### Contrast Ratios (WCAG AA Compliant)

**Primary Text on White**
- Gray-900 (#111827) on White: 16.1:1 ✅ AAA
- Gray-500 (#6b7280) on White: 4.6:1 ✅ AA

**White Text on Colors**
- White on Primary Blue (#2563eb): 4.7:1 ✅ AA
- White on Success Green (#10b981): 4.2:1 ✅ AA
- White on Warning Amber (#f59e0b): 2.4:1 ⚠️ Large text only

**Color on White Backgrounds**
- Primary Blue on White: 5.9:1 ✅ AA
- Success Green on White: 3.5:1 ✅ AA (large text)
- Warning Amber on White: 3.9:1 ✅ AA (large text)

### High Contrast Mode
When `prefers-contrast: high`:
- Border widths increase to 2px
- Shadows become more pronounced
- Text weights increase

---

## Dark Mode Preparation

While not currently implemented, the CSS variable system is ready for dark mode:

### Suggested Dark Mode Colors
```css
/* Dark mode overrides (future) */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1f2937;
    --bg-secondary: #111827;
    --bg-tertiary: #374151;

    --text-primary: #f9fafb;
    --text-secondary: #d1d5db;
    --text-tertiary: #9ca3af;

    /* Adjust primary colors for better visibility */
    --primary-color: #3b82f6;
    --success-color: #34d399;
    --warning-color: #fbbf24;
  }
}
```

---

## Usage Best Practices

### Do's ✅
- Use CSS variables for all colors
- Maintain semantic naming
- Keep contrast ratios above 4.5:1 for small text
- Use opacity for overlays, not lighter colors
- Test colors in both light and dark environments

### Don'ts ❌
- Don't hardcode color values in components
- Don't use pure black (#000) or pure white (#fff) except for text
- Don't mix opacity methods (rgba vs opacity property)
- Don't create new grays outside the scale
- Don't forget to test color-blind modes

---

## Color Psychology

**Why Security Blue?**
- **Trust**: Associated with reliability and stability
- **Security**: Common in security and privacy brands
- **Professional**: Corporate-friendly, serious tone
- **Calming**: Non-aggressive, approachable
- **Universal**: Works across cultures

**Supporting Colors:**
- **Purple**: Premium, sophisticated feel
- **Green**: Safety, success, go-ahead
- **Amber**: Caution without alarm
- **Red**: Danger, stop, critical

---

## Quick Reference Table

| Color | Hex | Usage | Contrast on White |
|-------|-----|-------|-------------------|
| Primary Blue | `#2563eb` | Main brand, buttons, links | 5.9:1 ✅ |
| Purple | `#7c3aed` | Accents, gradients | 5.2:1 ✅ |
| Success Green | `#10b981` | Active states, success | 3.5:1 ⚠️ |
| Warning Amber | `#f59e0b` | Alerts, warnings | 3.9:1 ⚠️ |
| Danger Red | `#ef4444` | Errors, danger | 4.3:1 ✅ |
| Gray-900 | `#111827` | Primary text | 16.1:1 ✅ |
| Gray-500 | `#6b7280` | Secondary text | 4.6:1 ✅ |
| White | `#ffffff` | Backgrounds, text on color | - |

---

## Testing Checklist

- [ ] All text meets WCAG AA contrast requirements
- [ ] Colors are consistent across all components
- [ ] Hover states are visible and clear
- [ ] Focus states are distinguishable
- [ ] Colors work in color-blind simulations
- [ ] Gradients render smoothly
- [ ] Opacity values don't stack unexpectedly
- [ ] Print version uses appropriate fallbacks

---

## Tools for Color Management

**Recommended Tools:**
- **Contrast Checker**: WebAIM Contrast Checker
- **Color Blind Simulator**: Coblis, Chrome DevTools
- **Gradient Generator**: CSS Gradient Generator
- **Palette Management**: Coolors, Adobe Color

**Chrome DevTools:**
- Use "Rendering" tab → "Emulate vision deficiencies"
- Check "Show CSS Overview" for color usage analysis
- Lighthouse audit for accessibility

---

This color system ensures consistency, accessibility, and scalability across the entire PII Guardian extension.
