# PII Guardian Popup Design Specification

## Visual Design

### Color Palette
- **Primary Purple**: `#667eea` → `#764ba2` (gradient)
- **Secondary Pink**: `#f093fb` → `#f5576c` (gradient)
- **White**: `#ffffff`
- **Background Gray**: `#f9f9f9`
- **Text Dark**: `#333333`
- **Text Light**: `#666666`
- **Success Green**: `#4CAF50`

### Layout Structure

```
┌─────────────────────────────────────┐
│  🛡️  PII Guardian      ● Active     │  ← Purple Gradient Header
├─────────────────────────────────────┤
│  ┌─────┐  ┌─────┐  ┌─────┐         │
│  │  0  │  │  0  │  │  0  │         │  ← Stats Cards (Light Gray BG)
│  │Detec│  │Mask │  │Block│         │
│  └─────┘  └─────┘  └─────┘         │
├─────────────────────────────────────┤
│  Protection              ⚪──○      │  ← Toggle Switch
├─────────────────────────────────────┤
│  [📊 Dashboard] [⚙️ Settings]       │  ← Action Buttons
├─────────────────────────────────────┤
│  ✨                                 │
│  Upgrade to Pro          [Upgrade]  │  ← Pink Gradient Banner
│  Advanced features...               │
├─────────────────────────────────────┤
│  Protecting your privacy locally    │  ← Footer
│  v1.0.0                             │
└─────────────────────────────────────┘
```

### Component Details

#### 1. Header (Purple Gradient)
- **Background**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Text Color**: White
- **Padding**: 20px
- **Elements**:
  - Shield icon + "PII Guardian" title
  - Status indicator with green dot when active

#### 2. Stats Grid
- **Background**: `#f9f9f9`
- **Layout**: 3-column grid
- **Cards**:
  - White background
  - Border radius: 12px
  - Box shadow: `0 2px 8px rgba(0, 0, 0, 0.05)`
  - Hover effect: slight lift + stronger shadow
  - Purple number values (`#667eea`)
  - Gray labels (uppercase, small)

#### 3. Toggle Section
- **Background**: White
- **Border**: 1px solid `#e0e0e0` (bottom)
- **Toggle Switch**:
  - Off state: Gray (`#ccc`)
  - On state: Purple (`#667eea`)
  - Smooth animation on toggle

#### 4. Quick Actions
- **Dashboard Button**:
  - Purple background (`#667eea`)
  - White text
  - Hover: Darker purple + shadow
- **Settings Button**:
  - Light gray background (`#f5f5f5`)
  - Dark text
  - Hover: Darker gray

#### 5. Pro Banner
- **Background**: `linear-gradient(135deg, #f093fb 0%, #f5576c 100%)`
- **Border Radius**: 12px
- **Sparkle Icon**: ✨
- **Upgrade Button**:
  - White background
  - Pink text
  - Hover: Scale up slightly

#### 6. Footer
- **Background**: `#f9f9f9`
- **Border**: 1px solid `#e0e0e0` (top)
- **Text**: Small gray text
- **Version**: Even lighter gray

## Typography

- **Font Family**: System font stack (San Francisco, Segoe UI, Roboto)
- **Header Title**: 18px, weight 600
- **Stat Values**: 24px, weight 700
- **Stat Labels**: 12px, uppercase, letter-spacing 0.5px
- **Button Text**: 13px, weight 500
- **Body Text**: 14px

## Interactions

### Hover Effects
- **Stat Cards**: Lift up 2px with stronger shadow
- **Primary Buttons**: Darken + shadow + lift
- **Secondary Buttons**: Darken background
- **Upgrade Button**: Scale to 105%

### Animations
- **Toggle Switch**: 0.3s ease transition
- **All Buttons**: 0.2s transition
- **Status Dot**: Pulsing glow when active

## Responsive Design

- **Fixed Width**: 360px
- **Minimum Height**: 500px
- **Scrollable**: Content scrolls if needed

## Accessibility

- **Color Contrast**: WCAG AA compliant
- **Focus States**: Ring on focused elements
- **Keyboard Navigation**: All interactive elements accessible
- **Screen Reader**: Semantic HTML with proper labels

## Browser Compatibility

- **Chrome**: 88+
- **Edge**: 88+
- **Firefox**: 78+ (if ported)
- **Safari**: 14+ (if ported)

---

**Status**: Design implemented in `/dist/styles/popup.css` (299 lines)
**Last Updated**: November 9, 2025
