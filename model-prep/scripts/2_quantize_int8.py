#!/usr/bin/env python3
"""
Quantize ONNX model to INT8
Phase 1.3: Quantize model to INT8
"""

import os
import subprocess
from pathlib import Path
import shutil

def run_quantization(input_dir, output_dir, quantization_type='int8'):
    """Run ONNX Runtime quantization using optimum-cli"""

    print("=" * 70)
    print(f"PII Guardian - Model Quantization ({quantization_type.upper()})")
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
    print(f"Step 1/2: Quantizing to {quantization_type.upper()}...")
    print("  This may take 2-3 minutes...")
    print()

    if quantization_type == 'int8':
        cmd = [
            'optimum-cli', 'onnxruntime', 'quantize',
            '--onnx_model', str(model_path),
            '-o', str(output_path),
            '--avx2'
        ]
    elif quantization_type == 'uint4':
        cmd = [
            'optimum-cli', 'onnxruntime', 'quantize',
            '--onnx_model', str(model_path),
            '-o', str(output_path),
            '--avx2'
        ]
    else:
        print(f"❌ Unknown quantization type: {quantization_type}")
        return False

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(result.stdout)
        print("✅ Quantization complete")
        print()
    except subprocess.CalledProcessError as e:
        print(f"❌ Quantization failed:")
        print(e.stderr)
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
    quantized_model = output_path / 'model.onnx'

    if not quantized_model.exists():
        # Try quantized filename
        quantized_model = output_path / 'model_quantized.onnx'

    if quantized_model.exists():
        size_mb = quantized_model.stat().st_size / 1024 / 1024
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
        print(f"  Type: {quantization_type.upper()}")
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
    success_int8 = run_quantization(
        './distilbert-ner-onnx',
        './distilbert-ner-int8',
        'int8'
    )

    if not success_int8:
        print("\n❌ INT8 quantization failed. Stopping.")
        return

    # Optional: UINT4 quantization (experimental)
    print("\n" + "=" * 70)
    response = input("Do you want to also quantize to UINT4? (y/N): ").lower()
    if response == 'y':
        print()
        success_uint4 = run_quantization(
            './distilbert-ner-onnx',
            './distilbert-ner-uint4',
            'uint4'
        )

        if success_uint4:
            print("\n✅ Both INT8 and UINT4 quantizations complete")
            print("   Compare accuracy with 3_validate_accuracy.py")
    else:
        print("\nSkipping UINT4 quantization.")

    print("\n✅ Quantization complete. Ready for validation.")

if __name__ == '__main__':
    main()
