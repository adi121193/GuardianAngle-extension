#!/usr/bin/env python3
"""
Quantize ONNX model to INT8
Phase 1.3: Quantize model to INT8 using Python API
"""

import os
import subprocess
from pathlib import Path
import shutil
from onnxruntime.quantization import quantize_dynamic, QuantType

def quantize_model_direct(input_dir, output_dir):
    """Quantize using onnxruntime quantization API directly"""

    print("=" * 70)
    print("PII Guardian - Model Quantization (INT8)")
    print("=" * 70)
    print()

    input_path = Path(input_dir)
    output_path = Path(output_dir)
    model_path = input_path / 'model.onnx'

    # Verify input exists
    if not model_path.exists():
        print(f"❌ Error: Input model not found at {model_path}")
        print("   Please run 1_export_to_onnx.py first")
        return False

    print(f"Input model: {model_path}")
    print(f"Output dir: {output_path}")
    print()

    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)

    # Step 1: Quantize model
    print("Step 1/2: Quantizing to INT8...")
    print("  This may take 2-3 minutes...")
    print()

    output_model = output_path / 'model.onnx'

    try:
        # Dynamic quantization (INT8)
        quantize_dynamic(
            str(model_path),
            str(output_model),
            weight_type=QuantType.QInt8
        )
        print("✅ Quantization complete")
        print()
    except Exception as e:
        print(f"❌ Quantization failed: {e}")
        return False

    # Step 2: Copy other files
    print("Step 2/2: Copying tokenizer and config files...")

    files_to_copy = [
        'tokenizer.json',
        'vocab.txt',
        'config.json',
        'special_tokens_map.json',
        'tokenizer_config.json',
        'label_map.json'
    ]

    for filename in files_to_copy:
        src = input_path / filename
        dst = output_path / filename
        if src.exists():
            shutil.copy2(src, dst)
            print(f"  ✅ {filename}")
        else:
            print(f"  ⚠️  {filename} (not found, skipping)")

    print()

    # Verify output
    print("Verifying quantized model...")

    if output_model.exists():
        size_mb = output_model.stat().st_size / 1024 / 1024
        original_size = model_path.stat().st_size / 1024 / 1024
        reduction = (1 - size_mb / original_size) * 100

        print(f"  Original size: {original_size:.2f} MB")
        print(f"  Quantized size: {size_mb:.2f} MB")
        print(f"  Size reduction: {reduction:.1f}%")
        print()

        # Summary
        print("=" * 70)
        print("Quantization Summary:")
        print("=" * 70)
        print(f"  Type: INT8")
        print(f"  Original: {original_size:.2f} MB")
        print(f"  Quantized: {size_mb:.2f} MB")
        print(f"  Reduction: {reduction:.1f}%")
        print(f"  Output: {output_path}")
        print(f"  Status: ✅ SUCCESS")
        print()
        print("Next step: Run 3_validate_accuracy.py to test accuracy")
        print("=" * 70)

        return True
    else:
        print("❌ Error: Quantized model not found")
        return False

def main():
    # INT8 quantization (recommended)
    success_int8 = quantize_model_direct(
        './distilbert-ner-onnx',
        './distilbert-ner-int8'
    )

    if not success_int8:
        print("\n❌ INT8 quantization failed.")
        return

    print("\n✅ Quantization complete. Ready for validation.")

if __name__ == '__main__':
    main()
