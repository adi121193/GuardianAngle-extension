# 🧪 PII Guardian - Comprehensive Testing Guide

**Complete testing checklist for QA team and developers**

---

## 📋 Testing Overview

This guide covers:
1. Installation & Load Testing
2. Functional Testing (PII Detection)
3. UI Testing (All Pages)
4. Integration Testing (AI Platforms)
5. Security Testing
6. Performance Testing
7. Cross-Browser Testing

**Estimated Total Time**: 8-12 hours for complete testing

---

## ✅ Pre-Testing Setup

### Environment Requirements
- [ ] Chrome/Edge/Brave browser (version 88+)
- [ ] Node.js 16+ installed
- [ ] Project built successfully (`npm run build`)
- [ ] Extension loaded in `chrome://extensions`

### Test Data Preparation

Create a test file with various PII types:

```text
# TEST_PII_DATA.txt

# Phone Numbers
Valid: 9876543210
Valid: +91-9876543210
Valid: (987) 654-3210
Invalid: 123 (too short)

# Aadhaar Numbers
Valid: 1234 5678 9012
Valid: 123456789012
Invalid: 1234 5678 901 (wrong format)

# PAN Cards
Valid: ABCDE1234F
Valid: abcde1234f (should uppercase)
Invalid: ABCD1234F (wrong format)

# Emails
Valid: test@example.com
Valid: user.name+tag@domain.co.uk
Invalid: @example.com (missing username)

# Credit Cards
Valid: 4111 1111 1111 1111 (Visa test card)
Valid: 5500 0000 0000 0004 (Mastercard test)
Invalid: 1234 5678 9012 3456 (fails Luhn)

# SSN (US)
Valid: 123-45-6789
Invalid: 123-456-789 (wrong format)

# Dates of Birth
Valid: 15/08/1990
Valid: 1990-08-15
Invalid: 32/13/2020 (invalid date)

# Bank Account
Valid: 1234567890123456 (16 digits)
Invalid: 123 (too short)

# IFSC Code
Valid: SBIN0001234
Invalid: SBI0001234 (missing N)

# GST Number
Valid: 29ABCDE1234F1Z5
Invalid: 29ABCDE1234 (incomplete)

# IP Address
Valid: 192.168.1.1
Valid: 10.0.0.1
Invalid: 256.1.1.1 (out of range)

# Passport
Valid: A1234567
Invalid: AB1234567 (wrong format)

# Driving License
Valid: MH1234567890123
Invalid: MH123 (too short)

# Vehicle Registration
Valid: MH 12 AB 1234
Invalid: MH AB 1234 (missing number)
```

---

## 1️⃣ Installation & Load Testing

### Test Case 1.1: Build Process
**Objective**: Verify build creates correct files

**Steps:**
1. Run `npm run build`
2. Check `dist/` folder created
3. Verify files exist:
   - `dist/content/monitorInputs.js`
   - `dist/ui/popup.js`
   - `dist/ui/settings.js`
   - `dist/ui/dashboard.js`
   - `dist/ui/license.js`
   - `dist/background/serviceWorker.js`
   - `dist/styles/popup.css`
   - `dist/styles/settings.css`

**Expected**: All files present, no build errors

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 1.2: Extension Load
**Objective**: Extension loads without errors

**Steps:**
1. Navigate to `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select `dist/` folder
5. Check for errors

**Expected**:
- Extension appears in list
- Purple shield icon visible
- No error messages
- Service worker shows "active"

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 1.3: Permissions Check
**Objective**: All required permissions granted

**Steps:**
1. In `chrome://extensions`, click "Details" on PII Guardian
2. Scroll to "Permissions" section
3. Verify permissions listed:
   - Read and change your data on 4 sites
   - Display notifications
   - Store unlimited client-side data

**Expected**: All permissions present

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 1.4: Service Worker Initialization
**Objective**: Background script runs correctly

**Steps:**
1. In `chrome://extensions`, find PII Guardian
2. Click "Service worker" link
3. Check console for initialization message

**Expected**: "PII Guardian service worker initialized" message appears

**Status**: ⬜ Pass / ⬜ Fail

---

## 2️⃣ Functional Testing - PII Detection

### Test Case 2.1: Phone Number Detection
**Objective**: Detect various phone number formats

| Input | Should Detect? | Actual Result | Pass/Fail |
|-------|---------------|---------------|-----------|
| `9876543210` | ✅ Yes | | ⬜ |
| `+91-9876543210` | ✅ Yes | | ⬜ |
| `(987) 654-3210` | ✅ Yes | | ⬜ |
| `123` | ❌ No | | ⬜ |

**Testing Platform**: ChatGPT
**Expected Modal**: Shows "Phone Number" detected

---

### Test Case 2.2: Aadhaar Detection
**Objective**: Detect Indian Aadhaar numbers

| Input | Should Detect? | Actual Result | Pass/Fail |
|-------|---------------|---------------|-----------|
| `1234 5678 9012` | ✅ Yes | | ⬜ |
| `123456789012` | ✅ Yes | | ⬜ |
| `1234 5678 901` | ❌ No | | ⬜ |

**Testing Platform**: Claude
**Expected Modal**: Shows "Aadhaar Number" detected

---

### Test Case 2.3: PAN Card Detection
**Objective**: Detect Indian PAN cards

| Input | Should Detect? | Actual Result | Pass/Fail |
|-------|---------------|---------------|-----------|
| `ABCDE1234F` | ✅ Yes | | ⬜ |
| `ABCD1234F` | ❌ No | | ⬜ |

**Testing Platform**: Gemini
**Expected Modal**: Shows "PAN Card" detected

---

### Test Case 2.4: Email Detection
**Objective**: Detect email addresses

| Input | Should Detect? | Actual Result | Pass/Fail |
|-------|---------------|---------------|-----------|
| `test@example.com` | ✅ Yes | | ⬜ |
| `user+tag@domain.co.uk` | ✅ Yes | | ⬜ |
| `@example.com` | ❌ No | | ⬜ |

**Testing Platform**: Perplexity
**Expected Modal**: Shows "Email Address" detected

---

### Test Case 2.5: Credit Card Detection
**Objective**: Detect credit card numbers

| Input | Should Detect? | Actual Result | Pass/Fail |
|-------|---------------|---------------|-----------|
| `4111 1111 1111 1111` | ✅ Yes | | ⬜ |
| `5500 0000 0000 0004` | ✅ Yes | | ⬜ |
| `1234 5678 9012 3456` | ❌ No (fails Luhn) | | ⬜ |

**Testing Platform**: ChatGPT
**Expected Modal**: Shows "Credit/Debit Card" detected

---

### Test Case 2.6: Multiple PII Detection
**Objective**: Detect multiple PII types in one input

**Input**:
```
My contact details:
Phone: 9876543210
Email: test@example.com
PAN: ABCDE1234F
```

**Expected**:
- Modal shows all 3 types detected
- List includes: Phone Number, Email Address, PAN Card

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 2.7: False Positive Check
**Objective**: Don't detect non-PII as PII

| Input | Should Detect? | Actual Result | Pass/Fail |
|-------|---------------|---------------|-----------|
| `The year 2024` | ❌ No | | ⬜ |
| `Version 1.2.3.4` | ❌ No | | ⬜ |
| `Call me at noon` | ❌ No | | ⬜ |
| `My ID is ABC` | ❌ No | | ⬜ |

**Status**: ⬜ Pass / ⬜ Fail

---

## 3️⃣ UI Testing - Warning Modal

### Test Case 3.1: Modal Appearance
**Objective**: Modal displays correctly

**Steps:**
1. Type PII on ChatGPT: `My phone is 9876543210`
2. Wait for modal to appear
3. Inspect modal visually

**Expected**:
- [ ] Modal appears within 1 second
- [ ] Purple gradient header visible
- [ ] Warning icon shows
- [ ] PII type listed correctly
- [ ] Confidence percentage shown
- [ ] Three buttons visible: Mask & Continue, Send Anyway, Cancel
- [ ] Modal is centered on screen
- [ ] Background is slightly darkened (overlay)

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 3.2: Mask & Continue Action
**Objective**: Masking works correctly

**Steps:**
1. Type: `My PAN is ABCDE1234F`
2. Click "Mask & Continue"
3. Check input field

**Expected**: Input changes to `My PAN is XXXXX1234F`

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 3.3: Send Anyway Action
**Objective**: Original text preserved

**Steps:**
1. Type: `My email is test@example.com`
2. Click "Send Anyway"
3. Check input field

**Expected**: Input remains `My email is test@example.com` (unchanged)

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 3.4: Cancel Action
**Objective**: Submission blocked

**Steps:**
1. Type: `My SSN is 123-45-6789`
2. Click "Cancel"
3. Check input field

**Expected**:
- Modal closes
- Input cleared (if block mode enabled)
- Or input remains but not submitted

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 3.5: Escape Key
**Objective**: Modal dismisses with Escape

**Steps:**
1. Type PII to trigger modal
2. Press Escape key
3. Check modal disappears

**Expected**: Modal closes (same as Cancel)

**Status**: ⬜ Pass / ⬜ Fail

---

## 4️⃣ UI Testing - Extension Pages

### Test Case 4.1: Popup Page
**Objective**: Popup renders and functions correctly

**Steps:**
1. Click extension icon in toolbar
2. Inspect popup UI

**Checklist**:
- [ ] Popup opens immediately
- [ ] Purple header with logo visible
- [ ] Status indicator shows "Active"
- [ ] Statistics cards display (3 cards)
- [ ] Toggle switch works
- [ ] Dashboard button clickable
- [ ] Settings button clickable
- [ ] Upgrade button visible (if not Pro)
- [ ] No console errors (right-click popup → Inspect)

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 4.2: Settings Page
**Objective**: Settings load and save correctly

**Steps:**
1. From popup, click "Settings"
2. Settings page opens in new tab
3. Test all controls

**Checklist**:
- [ ] Page loads without errors
- [ ] Auto-mask checkbox toggles
- [ ] Block on detection checkbox toggles
- [ ] Notification sound checkbox toggles
- [ ] Confidence slider moves (0-100)
- [ ] Slider value updates in real-time
- [ ] All 10 PII type checkboxes work
- [ ] Reset Statistics button visible
- [ ] Export Data button visible
- [ ] Reset Settings button visible
- [ ] Save button saves changes
- [ ] Success message appears after save

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 4.3: Dashboard Page
**Objective**: Dashboard displays statistics

**Steps:**
1. After detecting some PII, open Dashboard
2. Check statistics display

**Checklist**:
- [ ] Page loads without errors
- [ ] Total Detections count correct
- [ ] Total Masked count correct
- [ ] Total Blocked count correct
- [ ] Detections by Type list shows
- [ ] Counts match actual detections

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 4.4: License Page
**Objective**: License activation works

**Steps:**
1. From popup, click "Upgrade"
2. License page opens
3. Test activation

**Checklist**:
- [ ] Page loads without errors
- [ ] License input field visible
- [ ] Activate button works
- [ ] Invalid license shows error
- [ ] Valid license activates (if you have one)
- [ ] Current license section appears after activation
- [ ] Deactivate button works

**Status**: ⬜ Pass / ⬜ Fail

---

## 5️⃣ Integration Testing - AI Platforms

### Test Case 5.1: ChatGPT Integration
**Platform**: https://chat.openai.com

**Steps:**
1. Open ChatGPT
2. Find chat input (may be textarea or contenteditable)
3. Type test PII
4. Verify detection works

**Test Inputs**:
- [ ] Phone: `9876543210` → Modal appears
- [ ] Email: `test@example.com` → Modal appears
- [ ] Mixed: `Contact me at john@test.com or 9876543210` → Modal appears

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 5.2: Claude Integration
**Platform**: https://claude.ai

**Steps:**
1. Open Claude
2. Find chat input
3. Type test PII
4. Verify detection works

**Test Inputs**:
- [ ] PAN: `ABCDE1234F` → Modal appears
- [ ] Aadhaar: `1234 5678 9012` → Modal appears
- [ ] Mixed: `My PAN is ABCDE1234F` → Modal appears

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 5.3: Gemini Integration
**Platform**: https://gemini.google.com

**Steps:**
1. Open Gemini
2. Find chat input
3. Type test PII
4. Verify detection works

**Test Inputs**:
- [ ] SSN: `123-45-6789` → Modal appears
- [ ] Credit Card: `4111 1111 1111 1111` → Modal appears

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 5.4: Perplexity Integration
**Platform**: https://www.perplexity.ai

**Steps:**
1. Open Perplexity
2. Find search/chat input
3. Type test PII
4. Verify detection works

**Test Inputs**:
- [ ] Phone: `9876543210` → Modal appears
- [ ] Email: `user@example.com` → Modal appears

**Status**: ⬜ Pass / ⬜ Fail

---

## 6️⃣ Storage & Persistence Testing

### Test Case 6.1: Statistics Persistence
**Objective**: Stats save across sessions

**Steps:**
1. Trigger 5 PII detections
2. Mask 2, Send 2, Cancel 1
3. Check popup shows: Detections: 5, Masked: 2, Blocked: 1
4. Close browser completely
5. Reopen browser and check popup

**Expected**: Statistics persist (same numbers)

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 6.2: Settings Persistence
**Objective**: Settings save across sessions

**Steps:**
1. Open Settings
2. Change confidence to 80%
3. Disable "Email" PII type
4. Save settings
5. Close browser completely
6. Reopen and check Settings

**Expected**: Confidence still 80%, Email still disabled

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 6.3: Extension On/Off State
**Objective**: Toggle state persists

**Steps:**
1. Open popup
2. Toggle extension OFF
3. Close popup
4. Reopen popup

**Expected**: Extension still OFF

**Status**: ⬜ Pass / ⬜ Fail

---

## 7️⃣ Performance Testing

### Test Case 7.1: Detection Latency
**Objective**: Modal appears quickly

**Steps:**
1. Type PII on ChatGPT
2. Measure time until modal appears
3. Repeat 5 times, average

**Expected**: < 500ms average

**Results**:
- Test 1: ___ms
- Test 2: ___ms
- Test 3: ___ms
- Test 4: ___ms
- Test 5: ___ms
- Average: ___ms

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 7.2: Typing Performance
**Objective**: No lag while typing

**Steps:**
1. Type long paragraph quickly on ChatGPT (no PII)
2. Check for input lag or stuttering

**Expected**: Smooth typing, no noticeable delay

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 7.3: Memory Usage
**Objective**: Extension uses reasonable memory

**Steps:**
1. Open Chrome Task Manager (Shift+Esc)
2. Find "Extension: PII Guardian"
3. Check memory usage after 10 minutes of use

**Expected**: < 50MB

**Actual**: ___MB

**Status**: ⬜ Pass / ⬜ Fail

---

## 8️⃣ Security Testing

### Test Case 8.1: No Data Leakage
**Objective**: No PII sent to external servers

**Steps:**
1. Open browser DevTools → Network tab
2. Type PII on ChatGPT
3. Check network requests

**Expected**:
- No requests to unknown domains
- Only requests to ChatGPT itself
- No extension making external API calls

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 8.2: Console Security
**Objective**: No sensitive data logged

**Steps:**
1. Open browser console (F12)
2. Trigger PII detection
3. Check console logs

**Expected**:
- No PII values logged in clear text
- Only debug messages like "PII detected" (without actual PII)

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 8.3: Storage Encryption
**Objective**: Data stored securely

**Steps:**
1. Open popup → Inspect → Console
2. Run: `chrome.storage.local.get(null, console.log)`
3. Check stored data

**Expected**:
- Settings visible (not encrypted by default)
- No PII values in storage
- Statistics are just counts, not actual PII

**Status**: ⬜ Pass / ⬜ Fail

---

## 9️⃣ Cross-Browser Testing

### Test Case 9.1: Chrome
**Browser**: Google Chrome (latest)
**Steps**: Run all tests above

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 9.2: Edge
**Browser**: Microsoft Edge (latest)
**Steps**: Load extension in Edge, run core tests

**Status**: ⬜ Pass / ⬜ Fail

---

### Test Case 9.3: Brave
**Browser**: Brave Browser (latest)
**Steps**: Load extension in Brave, run core tests

**Status**: ⬜ Pass / ⬜ Fail

---

## 📊 Test Summary Report

**Total Test Cases**: 40+
**Passed**: ___
**Failed**: ___
**Blocked**: ___
**Not Tested**: ___

**Pass Rate**: ___%

### Critical Issues Found:
1.
2.
3.

### Medium Issues Found:
1.
2.
3.

### Minor Issues Found:
1.
2.
3.

### Overall Assessment:
⬜ READY FOR PRODUCTION
⬜ NEEDS FIXES BEFORE RELEASE
⬜ MAJOR ISSUES - EXTENSIVE REWORK NEEDED

### Recommendation:
_[Your recommendation here]_

---

## 📝 Bug Report Template

When you find a bug, use this format:

```
**BUG ID**: BUG-XXX
**Title**: Short description
**Severity**: CRITICAL / HIGH / MEDIUM / LOW
**Status**: NEW / IN PROGRESS / FIXED / VERIFIED

**Description**:
Detailed description of the issue

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Result**:
What should happen

**Actual Result**:
What actually happens

**Screenshots**:
[Attach if applicable]

**Environment**:
- Browser: Chrome 120
- OS: macOS Sonoma
- Extension Version: 1.0.0

**Notes**:
Additional information
```

---

**Testing completed by**: ________________
**Date**: ________________
**Signature**: ________________
