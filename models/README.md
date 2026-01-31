# Model Files - Download Instructions

The trained NER models are too large for GitHub (>100MB). You need to generate them locally.

## Quick Setup

```bash
# 1. Install Python dependencies
cd training/
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt

# 2. Option A: Download pre-trained model (if available)
# Contact repository owner for model files

# 3. Option B: Train from scratch (~2 hours)
python train.py

# 4. Export to ONNX
python export_onnx.py

# 5. Create quantized version (optional, recommended)
python quantize_model.py
```

## Model Files

After training/export, you should have:

```
models/distilbert-ner/
├── model.onnx              # 0.76 MB (included in repo)
├── model.onnx.data         # 249 MB (GENERATE LOCALLY)
├── model_quantized.onnx    # 63 MB (GENERATE LOCALLY)
├── tokenizer files         # Included in repo
└── config files            # Included in repo
```

## Training Data

Training data is included in `training/data/`:
- `train_merged.json` (1.4 MB) - 9,600 examples
- `val_merged.json` (278 KB) - 1,920 examples
- Additional synthetic datasets available

## Model Performance

- **Training Loss**: 0.0031 (99.86% reduction)
- **Validation Loss**: 0.004
- **All 4 PII types**: EMAIL, PHONE, PERSON, LOCATION (100% detection)

## Questions?

See `training/README.md` for detailed training instructions.
