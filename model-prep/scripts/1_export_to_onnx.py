#!/usr/bin/env python3
"""
Export DistilBERT-NER to ONNX format
Phase 1.2: Export model to ONNX
"""

import os
import json
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForTokenClassification
from optimum.onnxruntime import ORTModelForTokenClassification

def main():
    print("=" * 70)
    print("PII Guardian - Model Export to ONNX")
    print("=" * 70)
    print()

    # Configuration
    # Note: Using dslim/bert-base-NER as it's publicly available
    # Alternative: 'Elastic/distilbert-base-uncased-finetuned-conll03-english'
    model_name = 'dslim/bert-base-NER'
    output_dir = Path('./distilbert-ner-onnx')

    print(f"Model: {model_name}")
    print(f"Output: {output_dir}")
    print()

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Step 1: Load tokenizer
    print("Step 1/4: Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    print(f"✅ Tokenizer loaded (vocab size: {tokenizer.vocab_size})")
    print()

    # Step 2: Load model
    print("Step 2/4: Loading PyTorch model...")
    model = AutoModelForTokenClassification.from_pretrained(model_name)
    print(f"✅ Model loaded ({sum(p.numel() for p in model.parameters()) / 1e6:.1f}M parameters)")
    print()

    # Step 3: Export to ONNX
    print("Step 3/4: Exporting to ONNX format...")
    print("  This may take 1-2 minutes...")

    ort_model = ORTModelForTokenClassification.from_pretrained(
        model_name,
        export=True,
        provider='CPUExecutionProvider'
    )

    print("✅ ONNX export complete")
    print()

    # Step 4: Save model and tokenizer
    print("Step 4/4: Saving model and tokenizer...")

    ort_model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    # Save label mapping
    id2label = model.config.id2label
    label_map_path = output_dir / 'label_map.json'
    with open(label_map_path, 'w') as f:
        json.dump(id2label, f, indent=2)

    print(f"✅ Model saved to {output_dir}")
    print()

    # Verify files
    print("Verifying exported files...")
    required_files = [
        'model.onnx',
        'tokenizer.json',
        'vocab.txt',
        'config.json',
        'special_tokens_map.json',
        'label_map.json'
    ]

    for filename in required_files:
        filepath = output_dir / filename
        if filepath.exists():
            size_mb = filepath.stat().st_size / 1024 / 1024
            print(f"  ✅ {filename:30s} ({size_mb:6.2f} MB)")
        else:
            print(f"  ❌ {filename:30s} MISSING!")

    print()

    # Calculate total size
    total_size = sum(
        (output_dir / f).stat().st_size
        for f in required_files
        if (output_dir / f).exists()
    ) / 1024 / 1024

    print(f"Total size: {total_size:.2f} MB")
    print()

    # Summary
    print("=" * 70)
    print("Export Summary:")
    print("=" * 70)
    print(f"  Model: {model_name}")
    print(f"  Format: ONNX (FP32)")
    print(f"  Output: {output_dir}")
    print(f"  Size: {total_size:.2f} MB")
    print(f"  Status: ✅ SUCCESS")
    print()
    print("Next step: Run 2_quantize_int8.py to reduce size")
    print("=" * 70)

if __name__ == '__main__':
    main()
