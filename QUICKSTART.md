# 🚀 Quick Start Guide

Get PII Guardian running in **5 minutes**!

## Step 1: Generate Icons (1 minute)

Open the icon generator in your browser:

```bash
# Mac/Linux
open scripts/generate-icons.html

# Or just double-click the file
```

1. Click "Generate & Download All Icons"
2. Icons will download to your Downloads folder
3. Move all 4 PNG files to `assets/icons/` folder

## Step 2: Install Dependencies (Optional - 1 minute)

```bash
cd PII-Detection-Extension
npm install
```

> **Note**: This step is optional for basic usage. Only needed if you plan to use ONNX runtime or build tools.

## Step 3: Load Extension in Chrome (1 minute)

1. Open Chrome browser
2. Go to: `chrome://extensions`
3. Toggle **Developer mode** (top right corner)
4. Click **Load unpacked**
5. Select the `PII-Detection-Extension` folder
6. ✅ Extension loaded!

## Step 4: Test It! (2 minutes)

### Test 1: Basic PII Detection

1. Visit [ChatGPT](https://chat.openai.com) or [Claude](https://claude.ai)
2. In the chat input, type:
   ```
   My phone number is 9876543210
   ```
3. **Expected**: Warning modal appears! 🎉

### Test 2: Multiple PII Types

Type this in the chat:
```
My details:
Phone: 9876543210
Email: john.doe@example.com
PAN: ABCDE1234F
```

**Expected**: Modal shows all 3 detected PII types

### Test 3: Masking

1. Trigger a warning (type PII)
2. Click **"Mask & Continue"**
3. **Expected**: Input changes to:
   ```
   My details:
   Phone: 98****210
   Email: j***@example.com
   PAN: XXXXX1234F
   ```

### Test 4: Statistics

1. Click extension icon (puzzle piece in toolbar)
2. **Expected**: Popup shows detection count

## Step 5: Explore Features (Optional)

### Settings Page

1. Click extension icon
2. Click **"Settings"**
3. Try adjusting:
   - Confidence threshold slider
   - Enable/disable specific PII types
   - Auto-mask toggle

### Dashboard

1. Click extension icon
2. Click **"Dashboard"**
3. View statistics and detection breakdown

### Pro License (Testing)

1. Click extension icon
2. Click **"Upgrade"** (or go to License page)
3. Enter test license key (format):
   ```
   PIIGUARD::PRO::2026-01-01T00:00:00Z::<signature>
   ```

> **Note**: You need to generate actual signatures using the server-side script (see INSTALLATION.md)

---

## 🎯 Quick Reference

### Supported AI Sites
- ✅ ChatGPT (`chat.openai.com`)
- ✅ Claude (`claude.ai`)
- ✅ Gemini (`gemini.google.com`)
- ✅ Perplexity (`perplexity.ai`)

### Detected PII Types
- Aadhaar (Indian ID)
- PAN Card (Indian Tax ID)
- Phone numbers
- Email addresses
- Credit/Debit cards
- Bank account numbers
- Passport numbers
- SSN (Social Security)
- IFSC codes
- GST numbers
- Dates of birth
- IP addresses
- And more...

### User Actions
1. **Mask & Continue**: Auto-mask PII and submit
2. **Send Anyway**: Allow original text (not recommended)
3. **Cancel**: Block submission

---

## ✅ Success Checklist

- [ ] Icons generated and placed in `assets/icons/`
- [ ] Extension loaded in Chrome without errors
- [ ] Warning modal appears when typing PII
- [ ] Masking works correctly
- [ ] Statistics update in popup
- [ ] Settings page accessible
- [ ] Dashboard shows data

---

## 🐛 Troubleshooting

### Extension won't load
**Fix**: Check manifest.json for errors. Ensure all paths are correct.

### Icons not showing
**Fix**: Verify 4 PNG files exist in `assets/icons/` folder.

### Warning modal doesn't appear
**Fix**:
1. Check browser console (F12) for errors
2. Verify you're on a supported site
3. Ensure extension is enabled

### Content script errors
**Fix**: Make sure you're using `type="module"` in script tags (already configured).

---

## 📚 Next Steps

1. **Customize PII Patterns**: Edit `src/utils/regexPatterns.js`
2. **Add Custom Masking**: Edit `src/utils/maskRules.js`
3. **Integrate ONNX Model**: Add ML-based detection (optional)
4. **Add OCR Engine**: Enable image detection (Pro feature)
5. **Deploy**: Package for Chrome Web Store

---

## 🎓 Learn More

- Full setup: `INSTALLATION.md`
- Architecture: `DEVELOPMENT.md`
- Feature overview: `README.md`
- Project status: `PROJECT_SUMMARY.md`

---

## 💬 Common Questions

**Q: Is my data sent to a server?**
A: No. All processing happens locally in your browser.

**Q: Does it work on all websites?**
A: Currently configured for AI chat sites. You can add more sites in `manifest.json`.

**Q: Can I customize what PII is detected?**
A: Yes! Edit patterns in `src/utils/regexPatterns.js` and toggle types in Settings.

**Q: How do I get Pro features?**
A: Generate a license key using the server-side script (see INSTALLATION.md) or contact the developer.

**Q: Will it slow down my browser?**
A: No. Detection is debounced (300ms) and uses minimal CPU (<5%).

---

## 🎉 You're All Set!

Extension is ready to protect your privacy. Happy browsing! 🛡️

**Pro tip**: Pin the extension to your toolbar for quick access to stats and settings.
