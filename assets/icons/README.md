# PII Guardian Extension Icons

This directory contains the PNG icon files required for the PII Guardian Chrome Extension.

## Icon Files

| File | Size | Purpose |
|------|------|---------|
| `icon16.png` | 16x16 | Favicon in browser tabs |
| `icon32.png` | 32x32 | Extension toolbar icon |
| `icon48.png` | 48x48 | Extension management UI |
| `icon128.png` | 128x128 | Chrome Web Store listing |

## Design Specifications

- **Design**: Shield with checkmark symbol
- **Colors**: Gradient from `#667eea` to `#764ba2` (brand colors)
- **Icon Color**: White with rounded line caps
- **Format**: PNG with RGBA transparency
- **Style**: Modern, clean, professional

## Regenerating Icons

If you need to regenerate the icons:

### Method 1: NPM Script (Recommended)
```bash
npm run generate-icons
```

### Method 2: Direct Node.js
```bash
node scripts/generate-icons.js
```

### Method 3: HTML Generator (Browser)
1. Open `scripts/generate-icons.html` in a web browser
2. Click "Generate & Download All Icons"
3. Move downloaded files to this directory

## Technical Details

- Generated using Node.js Canvas API
- Script location: `/scripts/generate-icons.js`
- All icons use the same design scaled to different sizes
- Icons are referenced in `manifest.json` under `icons` and `action.default_icon`

## Chrome Extension Requirements

Chrome extensions require icons in specific sizes:
- **16x16**: Used as the favicon for pages the extension is active on
- **32x32**: Used in the browser toolbar (action icon)
- **48x48**: Used in the Extensions Management page
- **128x128**: Used in the Chrome Web Store and installation dialog

## Customization

To customize the icons:
1. Edit the `drawShieldIcon()` function in `/scripts/generate-icons.js`
2. Modify colors, shapes, or add new elements
3. Run `npm run generate-icons` to regenerate all sizes
4. Reload the extension in Chrome to see changes

## Troubleshooting

**Icons not appearing in Chrome?**
- Ensure all 4 PNG files exist in this directory
- Check that `manifest.json` paths are correct
- Reload the extension: `chrome://extensions` > Click reload icon
- Clear Chrome cache and restart browser

**Need different icons?**
- Replace these PNG files with your custom designs
- Maintain the same filenames and sizes
- Use PNG format with transparency for best results
- Follow Chrome's icon guidelines: https://developer.chrome.com/docs/extensions/mv3/manifest/icons/
