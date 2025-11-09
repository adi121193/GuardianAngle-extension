# 🧪 Testing Instructions - ONNX Removal Verification

## ✅ Implementation Complete

All code changes have been successfully implemented and the extension has been rebuilt.

**Status**: Ready for testing ✅

---

## 🚀 How to Load the Updated Extension

### Step 1: Reload Extension in Chrome

1. Open Chrome and go to: `chrome://extensions`
2. Find **"PII Guardian"** in the list
3. Click the **🔄 Reload** button (circular arrow icon)
4. The extension should reload with the new code

**OR** if you need to load fresh:

1. Go to `chrome://extensions`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Navigate to: `/Users/blaknwhite/Downloads/BuildLabs/PII-Detection-Extension/dist`
5. Click **"Select"**

---

## 🎯 Critical Verification Test

### **PRIMARY TEST: Verify NO ONNX Warning**

1. **Open Google Gemini**: https://gemini.google.com/app
2. **Open DevTools**: Press `F12` or `Cmd+Option+I` (Mac)
3. Click the **Console** tab
4. **Type in Gemini input**: `My Aadhaar is 1234 5678 9012`

### ✅ Expected Results:
- ✅ Warning modal appears blocking the message
- ✅ Console shows: `PII Guardian: Input monitoring initialized`
- ✅ **NO "ONNX Runtime not available" warning**
- ✅ NO errors in console
- ✅ Detection works perfectly

### ❌ If You Still See ONNX Warning:
- Extension may not have reloaded properly
- Try: Remove extension completely and reload from `dist` folder
- Clear Chrome cache: `chrome://settings/clearBrowserData`

---

## 📋 Full Test Suite

### Test 1: Aadhaar Detection
**Input**: `My Aadhaar number is 1234 5678 9012`

**Expected**:
- ✅ Warning modal appears
- ✅ Shows "Aadhaar Number" in detected types
- ✅ High confidence (>85%)

---

### Test 2: PAN Card Detection
**Input**: `My PAN is ABCDE1234F`

**Expected**:
- ✅ Warning modal appears
- ✅ Shows "PAN Card" in detected types
- ✅ Very high confidence (>95%)

---

### Test 3: Phone Number Detection
**Input**: `Call me at 9876543210`

**Expected**:
- ✅ Warning modal appears
- ✅ Shows "Phone Number" in detected types

---

### Test 4: Email Detection
**Input**: `Email me at john.doe@example.com`

**Expected**:
- ✅ Warning modal appears
- ✅ Shows "Email Address" in detected types

---

### Test 5: Credit Card Detection
**Input**: `My card is 4532 1234 5678 9010`

**Expected**:
- ✅ Warning modal appears
- ✅ Shows "Credit/Debit Card" in detected types

---

### Test 6: Multiple PII Types
**Input**:
```
My details:
Name: Rohan Malhotra
DOB: 16/04/1995
Mobile: 9876543210
PAN: BTEMP2345Q
Aadhaar: 1244 5667 8899
```

**Expected**:
- ✅ Warning modal appears
- ✅ Shows ALL detected PII types
- ✅ Multiple matches listed
- ✅ Critical risk level

---

## 🌐 Platform Testing

### Platform 1: Google Gemini ✅
**URL**: https://gemini.google.com/app

**Tests**:
- [ ] Aadhaar detection works
- [ ] PAN detection works
- [ ] Phone detection works
- [ ] Email detection works
- [ ] **Console has NO ONNX warnings**
- [ ] **Console has NO errors**

---

### Platform 2: ChatGPT
**URL**: https://chat.openai.com

**Tests**:
- [ ] Aadhaar detection works
- [ ] PAN detection works
- [ ] Phone detection works
- [ ] Email detection works
- [ ] Console clean

---

### Platform 3: Claude AI
**URL**: https://claude.ai

**Tests**:
- [ ] Aadhaar detection works
- [ ] PAN detection works
- [ ] Phone detection works
- [ ] Email detection works
- [ ] Console clean

---

### Platform 4: Perplexity AI
**URL**: https://perplexity.ai

**Tests**:
- [ ] Aadhaar detection works
- [ ] PAN detection works
- [ ] Phone detection works
- [ ] Email detection works
- [ ] Console clean

---

## 🔄 Edge Case Testing

### Test: Paste Detection
1. Copy: `My phone is 9876543210`
2. Paste into AI chat input
3. **Expected**: Warning appears BEFORE paste completes

---

### Test: Enter Key Blocking
1. Type: `My Aadhaar is 1234 5678 9012`
2. Press **Enter** key
3. **Expected**:
   - Enter is blocked
   - Modal appears
   - After "Send Anyway", message is sent

---

### Test: Send Button Blocking
1. Type: `My PAN is ABCDE1234F`
2. Click **Send** button
3. **Expected**:
   - Send is blocked
   - Modal appears
   - After "Send Anyway", message is sent

---

### Test: Masking Functionality
1. Type: `My Aadhaar is 1234 5678 9012`
2. Wait for modal
3. Click **"Mask & Continue"**
4. **Expected**: Input changes to `My Aadhaar is XXXX XXXX 9012`

---

### Test: Cancel Functionality
1. Type: `My phone is 9876543210`
2. Wait for modal
3. Click **"Cancel"**
4. **Expected**:
   - Modal closes
   - Original text remains
   - No message sent

---

## 📊 Statistics Verification

1. **Open Extension Popup**:
   - Click PII Guardian icon in Chrome toolbar

2. **Check Statistics**:
   - Total Detections: Should increment after each detection
   - Items Masked: Should increment when you click "Mask & Continue"
   - Items Blocked: Should increment when you click "Cancel"

3. **Open Dashboard**:
   - Click "Dashboard" button in popup
   - Verify stats are accurate
   - Check detection breakdown by type

---

## 🐛 What to Report

### If Tests PASS ✅
Reply with:
```
✅ All tests passed!
- NO ONNX warnings in console
- All PII types detected correctly
- Masking works
- Statistics tracking works
- Tested on: [List platforms you tested]
```

### If Tests FAIL ❌
Reply with:
1. **Screenshot of Console** (showing error/warning)
2. **Which test failed**
3. **What platform** (Gemini/ChatGPT/etc)
4. **Expected vs Actual behavior**

---

## 🔍 Console Inspection Guide

### What You SHOULD See in Console:
```
PII Guardian: Input monitoring initialized
```

### What You Should NOT See:
```
❌ ONNX Runtime not available, using regex-only detection
❌ Failed to load ONNX model
❌ Uncaught ReferenceError: ort is not defined
❌ Any red error messages
```

---

## 📸 Screenshot Guide

If you need to share console output:

1. Open DevTools: `F12` or `Cmd+Option+I`
2. Go to **Console** tab
3. Right-click → **Save as...** or take screenshot
4. Share the screenshot

---

## ✅ Success Checklist

- [ ] Extension reloaded in Chrome
- [ ] Tested on Google Gemini
- [ ] NO "ONNX Runtime not available" warning
- [ ] NO console errors
- [ ] All PII types detected correctly
- [ ] Modal appears and blocks input
- [ ] Masking works
- [ ] Statistics tracking works
- [ ] Dashboard shows data

---

## 🎉 Expected Outcome

After testing, you should have:

1. ✅ **Clean Console** - No ONNX warnings
2. ✅ **Working Detection** - All 16 PII types detected
3. ✅ **Functional UI** - Modal, masking, statistics all work
4. ✅ **Cross-Platform** - Works on Gemini, ChatGPT, Claude, Perplexity
5. ✅ **Reduced Bundle Size** - Extension is ~5MB smaller

---

## 📞 Next Steps

Once testing is complete:

1. **If all tests pass**:
   - Merge branch to main: `git checkout main && git merge remove-onnx-runtime`
   - Delete branch: `git branch -d remove-onnx-runtime`

2. **If issues found**:
   - Report issues with screenshots
   - We'll investigate and fix
   - Rollback available if needed: `git checkout main`

---

**Ready to test!** 🚀

Start with the **PRIMARY TEST** on Google Gemini and check for the ONNX warning.
