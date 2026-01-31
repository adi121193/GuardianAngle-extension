# NLP Integration - Phased Implementation Plan

**Version:** 1.3.0 Development Roadmap
**Date:** 2025-11-17
**Approach:** Incremental, checkpoint-based development

---

## 📋 Overview

This plan breaks down the NLP integration into 5 manageable phases, each with clear deliverables and success criteria. Each phase is a **checkpoint** that must be validated before proceeding to the next.

**Total Timeline:** 5-6 weeks
**Risk Level:** Medium (mitigated by phased approach)
**Team:** 1-2 developers

---

## 🎯 Phase 1: Foundations (Week 1)

**Goal:** Prepare and validate all ML assets before touching extension code.

### Tasks:

#### 1.1 Requirements Gathering (Day 1)
- [ ] **Model Selection:**
  - Primary: `distilbert-base-uncased-finetuned-ner` (67M params)
  - Alternative: `dslim/bert-base-NER` (109M params, more accurate)
  - **Decision:** DistilBERT (faster, smaller, sufficient accuracy)

- [ ] **Performance Targets:**
  - Max sequence length: **512 tokens**
  - Acceptable latency: **<100ms** (WASM), **<20ms** (WebGPU)
  - Storage budget: **<60MB** total (model + runtime)
  - Memory budget: **<150MB** runtime

- [ ] **Accuracy Requirements:**
  - Minimum F1 score: **>0.85** for person names
  - False positive rate: **<15%** (combined with regex)
  - Acceptable quantization loss: **<3% F1 degradation**

#### 1.2 Asset Preparation (Days 2-3)

**Export to ONNX:**
```bash
# Create model preparation directory
mkdir -p model-prep
cd model-prep

# Install dependencies
pip install transformers optimum onnx onnxruntime

# Export script
cat > export_model.py << 'EOF'
from transformers import AutoTokenizer, AutoModelForTokenClassification
from optimum.onnxruntime import ORTModelForTokenClassification
import json

model_name = 'distilbert-base-uncased-finetuned-ner'

print(f"Exporting {model_name} to ONNX...")

# Load model and tokenizer
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForTokenClassification.from_pretrained(model_name)

# Export to ONNX with dynamic axes
ort_model = ORTModelForTokenClassification.from_pretrained(
    model_name,
    export=True,
    provider='CPUExecutionProvider'
)

# Save
output_dir = './distilbert-ner-onnx'
ort_model.save_pretrained(output_dir)
tokenizer.save_pretrained(output_dir)

# Save label mapping
id2label = model.config.id2label
with open(f'{output_dir}/label_map.json', 'w') as f:
    json.dump(id2label, f, indent=2)

print(f"✅ Model exported to {output_dir}")
print(f"   Model size: {os.path.getsize(f'{output_dir}/model.onnx') / 1024 / 1024:.2f} MB")
EOF

python export_model.py
```

**Quantize to INT8:**
```bash
# Quantization script
optimum-cli onnxruntime quantize \
  --onnx_model ./distilbert-ner-onnx/model.onnx \
  --output_dir ./distilbert-ner-int8 \
  --weight_type qint8 \
  --per_channel \
  --activation_type quint8 \
  --operators_to_quantize MatMul Add

# Copy other files
cp ./distilbert-ner-onnx/{tokenizer.json,vocab.txt,config.json,special_tokens_map.json,label_map.json} ./distilbert-ner-int8/

echo "✅ INT8 quantization complete"
ls -lh ./distilbert-ner-int8/
```

**Optional: Quantize to UINT4 (experimental):**
```bash
# For comparison only - test if acceptable
optimum-cli onnxruntime quantize \
  --onnx_model ./distilbert-ner-onnx/model.onnx \
  --output_dir ./distilbert-ner-uint4 \
  --weight_type uint4 \
  --activation_type quint8 \
  --extra_options WeightSymmetric

cp ./distilbert-ner-onnx/{tokenizer.json,vocab.txt,config.json,special_tokens_map.json,label_map.json} ./distilbert-ner-uint4/
```

#### 1.3 Validation Testing (Days 4-5)

**Create validation script:**
```python
# validate_model.py
from optimum.onnxruntime import ORTModelForTokenClassification
from transformers import AutoTokenizer, pipeline
import numpy as np

# Test cases with ground truth
test_cases = [
    {
        "text": "My name is Rohan Malhotra and I live in Mumbai. My email is rohan@example.com",
        "expected_entities": [
            {"type": "PER", "value": "Rohan Malhotra"},
            {"type": "LOC", "value": "Mumbai"}
        ]
    },
    {
        "text": "John Smith works at Google in New York City. Contact: john@google.com",
        "expected_entities": [
            {"type": "PER", "value": "John Smith"},
            {"type": "ORG", "value": "Google"},
            {"type": "LOC", "value": "New York City"}
        ]
    },
    {
        "text": "The CEO of Microsoft, Satya Nadella, announced new products in Seattle.",
        "expected_entities": [
            {"type": "ORG", "value": "Microsoft"},
            {"type": "PER", "value": "Satya Nadella"},
            {"type": "LOC", "value": "Seattle"}
        ]
    }
]

def validate_model(model_path, quantization_type):
    print(f"\n{'='*60}")
    print(f"Validating {quantization_type} Model: {model_path}")
    print(f"{'='*60}\n")

    # Load model
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = ORTModelForTokenClassification.from_pretrained(model_path)

    ner = pipeline('ner', model=model, tokenizer=tokenizer, aggregation_strategy='simple')

    results = []

    for i, test in enumerate(test_cases, 1):
        print(f"Test {i}: {test['text']}")

        entities = ner(test['text'])

        print(f"  Detected: {len(entities)} entities")
        for ent in entities:
            print(f"    - {ent['entity_group']}: '{ent['word']}' (score: {ent['score']:.3f})")

        # Calculate metrics
        detected_types = set(e['entity_group'] for e in entities)
        expected_types = set(e['type'] for e in test['expected_entities'])

        precision = len(detected_types & expected_types) / len(detected_types) if detected_types else 0
        recall = len(detected_types & expected_types) / len(expected_types) if expected_types else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

        results.append({
            'test': i,
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'entities': entities
        })

        print(f"  Metrics: P={precision:.2f}, R={recall:.2f}, F1={f1:.2f}\n")

    # Overall metrics
    avg_f1 = np.mean([r['f1'] for r in results])
    avg_precision = np.mean([r['precision'] for r in results])
    avg_recall = np.mean([r['recall'] for r in results])

    print(f"\n{'='*60}")
    print(f"Overall Performance ({quantization_type}):")
    print(f"  Average Precision: {avg_precision:.3f}")
    print(f"  Average Recall: {avg_recall:.3f}")
    print(f"  Average F1: {avg_f1:.3f}")
    print(f"{'='*60}\n")

    return avg_f1

# Validate original ONNX
f1_original = validate_model('./distilbert-ner-onnx', 'Original FP32')

# Validate INT8
f1_int8 = validate_model('./distilbert-ner-int8', 'INT8 Quantized')

# Validate UINT4 (if exists)
try:
    f1_uint4 = validate_model('./distilbert-ner-uint4', 'UINT4 Quantized')
except:
    f1_uint4 = None

# Degradation analysis
print(f"\n{'='*60}")
print(f"Quantization Impact Analysis:")
print(f"{'='*60}")
print(f"Original FP32: F1 = {f1_original:.3f}")
print(f"INT8: F1 = {f1_int8:.3f} (degradation: {(f1_original - f1_int8):.3f})")
if f1_uint4:
    print(f"UINT4: F1 = {f1_uint4:.3f} (degradation: {(f1_original - f1_uint4):.3f})")

print(f"\n✅ Recommendation: ", end='')
if (f1_original - f1_int8) < 0.03:
    print("INT8 quantization acceptable (< 3% degradation)")
else:
    print("⚠️  INT8 degradation too high, consider FP32 or tune quantization")

if f1_uint4 and (f1_original - f1_uint4) < 0.05:
    print("   UINT4 also acceptable if storage is critical")
```

**Run validation:**
```bash
python validate_model.py

# Expected output:
# Original FP32: F1 = 0.92
# INT8: F1 = 0.90 (degradation: 0.02) ✅
# UINT4: F1 = 0.86 (degradation: 0.06) ⚠️
#
# ✅ Recommendation: INT8 quantization acceptable
```

#### 1.4 Repository Groundwork (Day 5)

**Create assets directory:**
```bash
cd /path/to/extension

# Create model assets directory
mkdir -p models/distilbert-ner

# Copy INT8 quantized model (recommended)
cp -r ../model-prep/distilbert-ner-int8/* models/distilbert-ner/

# Verify
ls -lh models/distilbert-ner/
# Expected files:
# - model.onnx (~35MB)
# - tokenizer.json (~500KB)
# - vocab.txt (~220KB)
# - config.json (~1KB)
# - special_tokens_map.json (~1KB)
# - label_map.json (~1KB)
```

**Update `.gitignore`:**
```bash
# Add to .gitignore
echo "models/distilbert-ner/*.onnx" >> .gitignore
echo "model-prep/" >> .gitignore
```

**Document licensing:**
```bash
cat > models/distilbert-ner/LICENSE.txt << 'EOF'
DistilBERT NER Model License
============================

Model: distilbert-base-uncased-finetuned-ner
Source: HuggingFace (https://huggingface.co/distilbert-base-uncased-finetuned-ner)
License: Apache 2.0

This model is bundled for on-device inference only.
No network calls are made.
No user data is transmitted.

Apache License 2.0
------------------
[Full Apache 2.0 license text]
EOF
```

**Create model README:**
```bash
cat > models/distilbert-ner/README.md << 'EOF'
# DistilBERT-NER Model Assets

## Model Details
- **Name:** distilbert-base-uncased-finetuned-ner
- **Parameters:** 67M
- **Quantization:** INT8
- **Size:** ~35MB
- **Task:** Named Entity Recognition (NER)

## Entities Detected
- **PER:** Person names
- **ORG:** Organizations
- **LOC:** Locations
- **MISC:** Miscellaneous entities

## Performance
- **Inference:** 10-20ms (WebGPU), 50-100ms (WASM)
- **F1 Score:** ~0.90 (post-quantization)
- **False Positive Rate:** <15%

## Privacy
✅ All inference runs locally in the browser
✅ No network calls made
✅ No user data transmitted
✅ Model loaded from extension bundle

## Files
- `model.onnx` - Quantized ONNX model
- `tokenizer.json` - Fast tokenizer
- `vocab.txt` - Vocabulary
- `config.json` - Model config
- `label_map.json` - Label ID to name mapping
EOF
```

### Phase 1 Deliverables:
- ✅ Model exported to ONNX (FP32)
- ✅ Model quantized to INT8 (validated <3% degradation)
- ✅ Tokenizer files prepared
- ✅ All assets in `models/distilbert-ner/`
- ✅ Licensing documented
- ✅ Validation results documented

### Phase 1 Success Criteria:
- ✅ INT8 model F1 score >0.85 on test cases
- ✅ Model size <40MB
- ✅ All required files present and valid
- ✅ No build errors when adding model directory

### Phase 1 Checkpoint Questions:
1. Is INT8 quantization accuracy acceptable? (degradation <3%)
2. Are all model files correctly formatted and loadable?
3. Is licensing documented?
4. Is model size within budget (<40MB)?

**If all YES → Proceed to Phase 2**
**If any NO → Fix before proceeding**

---

## ⚙️ Phase 2: Runtime Plumbing (Week 2)

**Goal:** Set up infrastructure to load and run the model in the browser.

### Tasks:

#### 2.1 Add Dependencies (Day 1)

**Install packages:**
```bash
npm install onnxruntime-web@latest
npm install @huggingface/tokenizers@latest

# Verify versions
npm list onnxruntime-web @huggingface/tokenizers
```

**Expected output:**
```
pii-guardian@1.3.0
├── onnxruntime-web@1.17.0
└── @huggingface/tokenizers@2.6.0
```

**Update package.json:**
```json
{
  "name": "pii-guardian",
  "version": "1.3.0",
  "dependencies": {
    "onnxruntime-web": "^1.17.0",
    "@huggingface/tokenizers": "^2.6.0"
  }
}
```

#### 2.2 Configure Bundler (Days 1-2)

**Update `esbuild.config.js`:**
```javascript
// esbuild.config.js
import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

console.log('🚀 Building PII Guardian Extension...\n');

// Clean dist folder
if (existsSync('./dist')) {
  console.log('🧹 Cleaning dist folder...');
  rmSync('./dist', { recursive: true });
}
mkdirSync('./dist', { recursive: true });

// Bundle JavaScript with ONNX Runtime Web
console.log('📦 Bundling JavaScript files...\n');

const buildOptions = {
  entryPoints: [
    './src/content/monitorInputs.js',
    './src/background/serviceWorker.js',
    './src/ui/popup.js',
    './src/offscreen/mlWorker.js'  // NEW: ML worker
  ],
  bundle: true,
  outdir: './dist',
  format: 'esm',
  platform: 'browser',
  target: ['chrome120'],
  minify: production,
  sourcemap: !production,
  external: [],  // Bundle everything
  define: {
    'process.env.NODE_ENV': production ? '"production"' : '"development"'
  }
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('👀 Watching for changes...\n');
} else {
  await esbuild.build(buildOptions);
  console.log('✅ JavaScript bundled successfully\n');
}

// Copy static files
console.log('📋 Copying static files...\n');

const filesToCopy = [
  { from: './manifest.json', to: './dist/manifest.json' },
  { from: './html', to: './dist/html' },
  { from: './src/styles', to: './dist/styles' },
  { from: './assets', to: './dist/assets' },
  { from: './models', to: './dist/models' }  // NEW: Model assets
];

function copyRecursive(src, dest) {
  if (!existsSync(src)) return;

  if (statSync(src).isDirectory()) {
    mkdirSync(dest, { recursive: true });
    readdirSync(src).forEach(file => {
      copyRecursive(join(src, file), join(dest, file));
    });
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
}

filesToCopy.forEach(({ from, to }) => {
  copyRecursive(from, to);
  console.log(`  → ${from}`);
});

// Copy ONNX Runtime WASM files
console.log('\n📦 Copying ONNX Runtime WASM files...\n');

const ortWasmPath = './node_modules/onnxruntime-web/dist';
const wasmDest = './dist/wasm';
mkdirSync(wasmDest, { recursive: true });

const wasmFiles = [
  'ort-wasm.wasm',
  'ort-wasm-threaded.wasm',
  'ort-wasm-simd.wasm',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm.js',
  'ort-wasm-threaded.worker.js'
];

wasmFiles.forEach(file => {
  const srcPath = join(ortWasmPath, file);
  const destPath = join(wasmDest, file);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    console.log(`  → ${file}`);
  }
});

// Copy Tokenizer WASM
console.log('\n📦 Copying Tokenizer WASM files...\n');

const tokenizerWasmPath = './node_modules/@huggingface/tokenizers/dist';
const tokenizerDest = './dist/tokenizers';
mkdirSync(tokenizerDest, { recursive: true });

const tokenizerFiles = ['tokenizers_bg.wasm'];

tokenizerFiles.forEach(file => {
  const srcPath = join(tokenizerWasmPath, file);
  const destPath = join(tokenizerDest, file);
  if (existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    console.log(`  → ${file}`);
  }
});

console.log('\n✅ Build complete!\n');
console.log('📂 Output directory: dist/');
console.log('🔧 To load in Chrome:');
console.log('   1. Go to chrome://extensions');
console.log('   2. Enable "Developer mode"');
console.log('   3. Click "Load unpacked"');
console.log('   4. Select the "dist" folder\n');
```

#### 2.3 Update Manifest (Day 2)

**Update `manifest.json`:**
```json
{
  "manifest_version": 3,
  "name": "PII Guardian",
  "version": "1.3.0",
  "description": "Local AI Privacy Browser Extension - Hybrid PII detection with on-device ML",
  "permissions": [
    "storage",
    "scripting",
    "activeTab",
    "notifications",
    "alarms",
    "tabs",
    "offscreen"
  ],
  "background": {
    "service_worker": "background/serviceWorker.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://chat.openai.com/*",
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
        "https://www.perplexity.ai/*",
        "https://x.com/*",
        "https://twitter.com/*"
      ],
      "js": ["content/monitorInputs.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "html/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "32": "assets/icons/icon32.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  "icons": {
    "16": "assets/icons/icon16.png",
    "32": "assets/icons/icon32.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  },
  "web_accessible_resources": [
    {
      "resources": [
        "models/*",
        "wasm/*",
        "tokenizers/*",
        "styles/*",
        "assets/*"
      ],
      "matches": ["<all_urls>"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

#### 2.4 Create Offscreen Document (Days 3-4)

**Create `html/offscreen.html`:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PII Guardian ML Worker</title>
</head>
<body>
  <h2>PII Guardian ML Worker</h2>
  <p>This background page runs ML inference for PII detection.</p>
  <p id="status">Initializing...</p>
  <script type="module" src="../offscreen/mlWorker.js"></script>
</body>
</html>
```

**Implement `src/offscreen/mlWorker.js`:**
```javascript
// Basic structure - will be filled in Phase 3
console.log('PII Guardian ML Worker: Starting...');

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('ML Worker received message:', message.type);

  if (message.type === 'ML_PING') {
    sendResponse({ status: 'alive' });
    return true;
  }

  if (message.type === 'ML_INITIALIZE') {
    // TODO: Initialize ONNX + Tokenizer
    sendResponse({ initialized: true });
    return true;
  }

  if (message.type === 'ML_DETECT_PII') {
    // TODO: Run inference
    sendResponse({ piiDetected: false, entities: [] });
    return true;
  }
});

document.getElementById('status').textContent = 'ML Worker ready (stub mode)';
```

#### 2.5 Create Messaging Client (Day 4)

**Create `src/ml/mlClient.js`:**
```javascript
/**
 * Client for communicating with ML worker (offscreen document)
 */

let offscreenReady = false;
const pendingRequests = new Map();
let requestId = 0;
const REQUEST_TIMEOUT = 10000; // 10s timeout

/**
 * Ensure offscreen document exists
 */
async function ensureOffscreenDocument() {
  if (offscreenReady) return true;

  try {
    // Check if already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
      offscreenReady = true;
      return true;
    }

    // Create offscreen document
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('html/offscreen.html'),
      reasons: ['WORKERS'],
      justification: 'Run ML inference for PII detection'
    });

    offscreenReady = true;
    console.log('PII Guardian: Offscreen document created');

    // Ping to verify
    const pingResponse = await sendToWorker({ type: 'ML_PING' }, 1000);
    if (pingResponse.status !== 'alive') {
      throw new Error('Worker not responding');
    }

    return true;

  } catch (error) {
    console.error('PII Guardian: Failed to create offscreen document:', error);
    return false;
  }
}

/**
 * Send message to ML worker with timeout
 */
async function sendToWorker(message, timeout = REQUEST_TIMEOUT) {
  const ready = await ensureOffscreenDocument();
  if (!ready) {
    throw new Error('ML worker not available');
  }

  return new Promise((resolve, reject) => {
    const id = requestId++;
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('ML request timeout'));
    }, timeout);

    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      pendingRequests.delete(id);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });

    pendingRequests.set(id, { resolve, reject, timer });
  });
}

/**
 * Initialize ML worker
 */
export async function initializeMLWorker() {
  try {
    const response = await sendToWorker({ type: 'ML_INITIALIZE' }, 30000); // 30s for init
    return response.initialized;
  } catch (error) {
    console.error('PII Guardian: ML worker initialization failed:', error);
    return false;
  }
}

/**
 * Detect PII using ML model
 */
export async function detectPIIWithML(text, options = {}) {
  try {
    const response = await sendToWorker({
      type: 'ML_DETECT_PII',
      text,
      options
    });

    return response;

  } catch (error) {
    console.error('PII Guardian: ML detection failed:', error);
    return {
      piiDetected: false,
      entities: [],
      error: error.message
    };
  }
}

/**
 * Warm up ML worker (preload model)
 */
export async function warmupMLWorker() {
  try {
    console.log('PII Guardian: Warming up ML worker...');
    const initialized = await initializeMLWorker();
    if (initialized) {
      console.log('PII Guardian: ML worker ready');
    }
  } catch (error) {
    console.error('PII Guardian: ML worker warmup failed:', error);
  }
}
```

#### 2.6 Test Infrastructure (Day 5)

**Create test script:**
```javascript
// test/test-ml-worker.js
import { initializeMLWorker, detectPIIWithML, warmupMLWorker } from '../src/ml/mlClient.js';

async function testMLWorker() {
  console.log('Testing ML Worker Infrastructure...\n');

  // Test 1: Warmup
  console.log('Test 1: Warmup ML worker');
  await warmupMLWorker();
  console.log('✅ Warmup complete\n');

  // Test 2: Initialize
  console.log('Test 2: Initialize ML worker');
  const initialized = await initializeMLWorker();
  console.log(`  Result: ${initialized ? '✅ Initialized' : '❌ Failed'}\n`);

  // Test 3: Detect PII (stub mode)
  console.log('Test 3: Detect PII (stub mode)');
  const result = await detectPIIWithML('My name is John Smith');
  console.log(`  Result: ${JSON.stringify(result, null, 2)}\n`);

  console.log('✅ All infrastructure tests passed');
}

testMLWorker().catch(console.error);
```

**Run test:**
```bash
npm run build
# Load extension in Chrome
# Open DevTools console
# Run test script
```

### Phase 2 Deliverables:
- ✅ ONNX Runtime Web installed
- ✅ Tokenizer library installed
- ✅ Build script copies WASM files
- ✅ Offscreen document created
- ✅ Messaging client implemented
- ✅ Infrastructure tests pass

### Phase 2 Success Criteria:
- ✅ Extension loads without errors
- ✅ Offscreen document created successfully
- ✅ ML worker responds to ping
- ✅ WASM files accessible via chrome.runtime.getURL
- ✅ No CSP errors

### Phase 2 Checkpoint Questions:
1. Does extension load in Chrome without errors?
2. Is offscreen document created and responding?
3. Are WASM files correctly bundled and accessible?
4. Does messaging between content script and worker function?

**If all YES → Proceed to Phase 3**
**If any NO → Debug infrastructure before proceeding**

---

## 🔍 Phase 3: Detection Integration (Week 3)

**Goal:** Implement actual ML inference and integrate with existing regex detection.

### Tasks:

#### 3.1 Implement ONNX Manager (Days 1-2)

**Create `src/ml/onnxManager.js`:**
```javascript
// [Full implementation from architecture doc]
// Includes:
// - ORT initialization with WebGPU/WASM fallback
// - Session creation with optimization
// - Inference execution
// - Tensor management
```

#### 3.2 Implement Tokenizer Manager (Days 2-3)

**Create `src/ml/tokenizer.js`:**
```javascript
// [Full implementation from architecture doc]
// Includes:
// - Tokenizer loading
// - Encode/decode functions
// - Caching system
// - Offset tracking for entity mapping
```

#### 3.3 Implement ML Worker Logic (Days 3-4)

**Update `src/offscreen/mlWorker.js`:**
```javascript
// [Full implementation from architecture doc]
// Includes:
// - ONNX + Tokenizer initialization
// - NER inference pipeline
// - Entity decoding
// - Confidence filtering
```

#### 3.4 Update Hybrid Detection Pipeline (Days 4-5)

**Update `src/content/detectText.js`:**
```javascript
// [Full implementation from architecture doc]
// Includes:
// - Regex detection (fast path)
// - NER detection (parallel)
// - Result merging
// - Deduplication
```

### Phase 3 Deliverables:
- ✅ ONNX Runtime functional
- ✅ Tokenizer functional
- ✅ ML worker performs inference
- ✅ Hybrid detection pipeline working
- ✅ Results merged and deduplicated

### Phase 3 Success Criteria:
- ✅ Model loads successfully in browser
- ✅ Tokenization works correctly
- ✅ Inference completes without errors
- ✅ Entities extracted accurately
- ✅ Hybrid detection returns combined results

---

## 🎨 Phase 4: UX & Controls (Week 4)

**Goal:** Add user-facing controls and documentation for NER feature.

### Tasks:

#### 4.1 Add Settings UI (Days 1-2)
- [ ] Toggle for "Contextual (NER) Detection"
- [ ] Confidence threshold sliders (regex vs NER)
- [ ] Performance mode selector (WebGPU/WASM/Off)
- [ ] Telemetry counters (entities detected by type)

#### 4.2 Update Detection UI (Days 2-3)
- [ ] Show entity source in panel (regex vs NER badge)
- [ ] Different colors for regex vs NER matches
- [ ] Performance stats display (inference time)

#### 4.3 Add Privacy Messaging (Day 3)
- [ ] Onboarding: "On-device ML, no data leaves browser"
- [ ] Settings page: Privacy guarantees documentation
- [ ] Badge showing "Local AI" when NER active

#### 4.4 Implement Fallbacks (Days 4-5)
- [ ] Disable NER if model fails to load
- [ ] Show warning badge if NER unavailable
- [ ] Graceful degradation to regex-only mode

### Phase 4 Deliverables:
- ✅ Settings UI with NER controls
- ✅ Visual indicators for NER vs regex
- ✅ Privacy messaging integrated
- ✅ Fallback mechanisms implemented

### Phase 4 Success Criteria:
- ✅ Users can enable/disable NER
- ✅ Users understand privacy guarantees
- ✅ Extension works even if NER fails
- ✅ Performance stats visible

---

## 🚀 Phase 5: Performance & QA (Week 5-6)

**Goal:** Optimize, test, and validate for production release.

### Tasks:

#### 5.1 Performance Optimization (Days 1-3)
- [ ] Enable WebGPU when available
- [ ] Benchmark WebGPU vs WASM inference
- [ ] Profile memory usage
- [ ] Implement throttling/backoff strategies
- [ ] Optimize chunk size for best speed/accuracy

#### 5.2 Automated Testing (Days 3-4)
- [ ] Unit tests for tokenizer
- [ ] Unit tests for ONNX manager
- [ ] Integration tests for worker messaging
- [ ] End-to-end tests simulating long prompts
- [ ] Regression suite comparing regex-only vs hybrid

#### 5.3 Benchmarking (Day 4)
- [ ] Measure inference time across platforms
- [ ] Test on various text lengths
- [ ] Compare accuracy vs baseline
- [ ] Memory profiling

#### 5.4 Phased Rollout (Days 5-6)
- [ ] Dogfood internally (team testing)
- [ ] Gather metrics (detection accuracy, performance)
- [ ] Adjust confidence thresholds based on data
- [ ] Finalize documentation
- [ ] Create release notes for v1.3.0

### Phase 5 Deliverables:
- ✅ Performance optimized
- ✅ Automated tests passing
- ✅ Benchmarks documented
- ✅ Production-ready build

### Phase 5 Success Criteria:
- ✅ WebGPU inference <20ms
- ✅ WASM inference <100ms
- ✅ Memory usage <200MB
- ✅ All tests passing
- ✅ Accuracy >90% on test set

---

## 📊 Overall Timeline

| Phase | Duration | Deliverables | Gate |
|-------|----------|-------------|------|
| 1. Foundations | Week 1 | Model assets validated | F1 >0.85, size <40MB |
| 2. Runtime | Week 2 | Infrastructure working | Extension loads, worker responds |
| 3. Integration | Week 3 | Hybrid detection working | Inference completes, results merge |
| 4. UX | Week 4 | User controls added | Settings functional, fallbacks work |
| 5. Performance | Weeks 5-6 | Optimized & tested | Tests pass, benchmarks meet targets |

**Total: 5-6 weeks**

---

## ✅ Success Metrics

### Technical Metrics:
- Model F1 score: **>0.85**
- Inference latency: **<20ms (WebGPU), <100ms (WASM)**
- Memory usage: **<200MB**
- Model size: **<40MB**
- False positive rate: **<15% (hybrid)**

### UX Metrics:
- No UI freeze during typing
- Grammarly-like responsiveness
- Clear privacy messaging
- Graceful degradation

### Privacy Metrics:
- ✅ 100% on-device inference
- ✅ No network calls
- ✅ No data transmitted
- ✅ Model bundled in extension

---

## 🎯 Ready to Start?

**Next Immediate Steps:**
1. Approve this phased plan
2. Set up model preparation environment
3. Begin Phase 1: Export DistilBERT to ONNX
4. Validate quantization accuracy
5. Create checkpoint review after Phase 1

**Questions Before Starting:**
- Should we proceed with INT8 quantization primarily?
- Do you want to explore UINT4 as an alternative?
- Should we set up a separate branch for NLP work?
- Do you want daily progress updates or weekly checkpoints?
