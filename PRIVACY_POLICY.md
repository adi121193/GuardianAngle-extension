# Privacy Policy for Guardian Angle

**Last Updated:** February 4, 2026

## Overview

Guardian Angle is a browser extension designed to detect and protect Personally Identifiable Information (PII) before it is sent to AI platforms. We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection and Processing

### What We Process

Guardian Angle processes text that you type into supported AI platforms (ChatGPT, Claude, Gemini, Perplexity, and X/Twitter) to detect potential PII such as:

- Aadhaar numbers
- PAN card numbers
- Phone numbers
- Email addresses
- Credit card numbers
- Bank account numbers
- Passport numbers
- Social Security Numbers (SSN)
- Date of birth
- IP addresses
- Driving license numbers
- Vehicle registration numbers
- Medical record numbers

### How We Process Data

**All PII detection runs entirely on your local device.** Guardian Angle:

- Does NOT send your text or detected PII to any external servers
- Does NOT collect, store, or transmit your personal information
- Does NOT use cloud-based AI services for detection
- Processes all data using local regex pattern matching and optional local OCR (Pro version)

### Data Storage

Guardian Angle stores the following data locally in your browser using Chrome's storage API:

| Data Type | Purpose | Location |
|-----------|---------|----------|
| Extension settings | User preferences (enabled PII types, notification settings) | Local browser storage |
| Detection statistics | Aggregate counts only (total detections, masks, blocks) | Local browser storage |
| License information (Pro) | License key validation status | Local browser storage |

**No PII content is ever stored.** Only anonymous aggregate statistics are maintained.

## Third-Party Services

### LemonSqueezy (Pro Version Only)

For Pro license validation, Guardian Angle communicates with LemonSqueezy's API:

- **Data sent:** License key, anonymous instance identifier
- **Purpose:** License validation and activation
- **Privacy policy:** [LemonSqueezy Privacy Policy](https://www.lemonsqueezy.com/privacy)

No user content, browsing data, or detected PII is ever sent to LemonSqueezy.

## Permissions Explained

Guardian Angle requests the following browser permissions:

| Permission | Purpose |
|------------|---------|
| `storage` | Save your settings and anonymous statistics locally |
| `activeTab` | Access the current tab to monitor text input on supported AI platforms |
| `scripting` | Inject content scripts to detect PII in real-time |
| `notifications` | Alert you when PII is detected |
| `alarms` | Schedule periodic license checks (Pro) |
| `tabs` | Identify when you're on a supported AI platform |
| `offscreen` | Run OCR processing in an isolated environment (Pro) |

### Host Permissions

Guardian Angle only has access to the following websites:

- chat.openai.com / chatgpt.com (ChatGPT)
- claude.ai (Claude)
- gemini.google.com (Gemini)
- www.perplexity.ai (Perplexity)
- x.com / twitter.com (X/Twitter)

The extension cannot access any other websites or your general browsing activity.

## Data Security

- All processing occurs locally on your device
- No data is transmitted to our servers
- No analytics or tracking is implemented
- No user behavior data is collected
- Shadow DOM isolation prevents CSS/JS conflicts with host pages

## Children's Privacy

Guardian Angle does not knowingly collect information from children under 13. The extension processes data locally and does not collect personal information from any users.

## Changes to This Policy

We may update this privacy policy from time to time. We will notify users of any material changes by updating the "Last Updated" date at the top of this policy.

## Your Rights

Since Guardian Angle does not collect or store your personal data on external servers:

- There is no personal data to request, modify, or delete from our systems
- All data is stored locally in your browser and can be cleared by uninstalling the extension or clearing browser data

## Open Source

Guardian Angle's source code is available for review, allowing you to verify our privacy practices.

## Contact

If you have questions about this privacy policy or Guardian Angle's privacy practices, please contact us at:

- GitHub Issues: [Guardian Angle Repository](https://github.com/adi121193/GuardianAngle-extension)
- Email: [your-email@example.com]

---

## Summary

**Guardian Angle is designed with privacy as its core principle:**

1. All PII detection runs 100% locally on your device
2. No user data is collected, stored, or transmitted
3. No cloud services are used for detection
4. Only anonymous aggregate statistics are stored locally
5. Pro license validation is the only external communication (license key only)

Your privacy is protected by design, not just by policy.
