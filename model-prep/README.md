# Model Preparation - Phase 1

This directory contains scripts to prepare the DistilBERT-NER model for browser deployment.

## Prerequisites

- **Python:** 3.8 or higher
- **pip:** Latest version
- **Git:** For cloning HuggingFace models

## Quick Start

### 1. Set up Python environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate (macOS/Linux)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run model preparation scripts

```bash
cd scripts

# Step 1: Export to ONNX (FP32)
python 1_export_to_onnx.py

# Step 2: Quantize to INT8
python 2_quantize_int8.py

# Step 3: Validate accuracy
python 3_validate_accuracy.py
```

## Scripts Overview

### 1_export_to_onnx.py
- Downloads DistilBERT-NER from HuggingFace
- Exports to ONNX format (FP32)
- Saves tokenizer files
- Creates label mapping

**Output:** `./distilbert-ner-onnx/` (~67MB)

### 2_quantize_int8.py
- Quantizes ONNX model to INT8
- Optionally quantizes to UINT4
- Copies tokenizer files

**Output:**
- `./distilbert-ner-int8/` (~35-40MB)
- `./distilbert-ner-uint4/` (~18-20MB, optional)

### 3_validate_accuracy.py
- Tests model accuracy on sample data
- Compares FP32 vs INT8 vs UINT4
- Calculates F1, precision, recall
- Provides recommendation

**Output:** `./validation_results.json`

## Expected Timeline

- **Step 1 (Export):** 2-3 minutes
- **Step 2 (Quantize):** 3-5 minutes
- **Step 3 (Validate):** 1-2 minutes

**Total:** ~10 minutes

## Success Criteria

✅ **Model Quality:**
- INT8 F1 score >0.85
- Quantization degradation <3%

✅ **File Size:**
- INT8 model <40MB
- All assets <50MB

✅ **Files Created:**
- model.onnx
- tokenizer.json
- vocab.txt
- config.json
- special_tokens_map.json
- label_map.json

## Troubleshooting

### "ModuleNotFoundError: No module named 'transformers'"
```bash
pip install -r requirements.txt
```

### "optimum-cli: command not found"
```bash
pip install optimum[onnxruntime]
```

### "ONNX export failed"
- Ensure you have enough disk space (1GB free)
- Check Python version (3.8+)
- Try updating transformers: `pip install --upgrade transformers`

### "Quantization too slow"
- Normal for first run (downloads model)
- Should take 3-5 minutes
- Subsequent runs faster (uses cache)

## Output Structure

After successful execution:

```
model-prep/
├── requirements.txt
├── README.md
├── scripts/
│   ├── 1_export_to_onnx.py
│   ├── 2_quantize_int8.py
│   └── 3_validate_accuracy.py
├── distilbert-ner-onnx/        # FP32 model (~67MB)
│   ├── model.onnx
│   ├── tokenizer.json
│   ├── vocab.txt
│   ├── config.json
│   └── label_map.json
├── distilbert-ner-int8/        # INT8 model (~35MB) ← USE THIS
│   ├── model.onnx
│   ├── tokenizer.json
│   ├── vocab.txt
│   ├── config.json
│   └── label_map.json
└── validation_results.json     # Accuracy metrics
```

## Next Steps

After Phase 1 is complete:

1. **Copy INT8 model to extension:**
   ```bash
   cd ..
   mkdir -p models/distilbert-ner
   cp -r model-prep/distilbert-ner-int8/* models/distilbert-ner/
   ```

2. **Verify in extension:**
   ```bash
   ls -lh models/distilbert-ner/
   ```

3. **Update .gitignore:**
   ```bash
   echo "models/distilbert-ner/*.onnx" >> .gitignore
   ```

4. **Proceed to Phase 2:** Runtime Plumbing

## License

The DistilBERT-NER model is licensed under Apache 2.0.
See `models/distilbert-ner/LICENSE.txt` after copying to extension.
