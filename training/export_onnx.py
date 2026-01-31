#!/usr/bin/env python3
"""
Export trained PyTorch model to ONNX format for production deployment.
"""

import torch
import os
from transformers import DistilBertTokenizerFast, DistilBertForTokenClassification

# Configuration
MODEL_DIR = "./results_v2"
OUTPUT_DIR = "./models/distilbert-ner"
ONNX_MODEL_PATH = os.path.join(OUTPUT_DIR, "model.onnx")

def export_to_onnx():
    print("🚀 Starting ONNX Export Process")
    print("=" * 60)
    
    # Load the trained model
    print(f"\n📥 Loading trained model from: {MODEL_DIR}")
    try:
        tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-cased")
        model = DistilBertForTokenClassification.from_pretrained(MODEL_DIR)
        model.eval()
        print("✅ Model loaded successfully")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"\n📁 Output directory: {OUTPUT_DIR}")
    
    # Prepare dummy input for ONNX export
    print("\n🔧 Preparing dummy input for export...")
    dummy_text = "This is a sample text for ONNX export."
    inputs = tokenizer(dummy_text, return_tensors="pt", padding=True, truncation=True, max_length=128)
    
    # Get input names and dynamic axes
    input_names = ['input_ids', 'attention_mask']
    output_names = ['logits']
    
    dynamic_axes = {
        'input_ids': {0: 'batch_size', 1: 'sequence_length'},
        'attention_mask': {0: 'batch_size', 1: 'sequence_length'},
        'logits': {0: 'batch_size', 1: 'sequence_length'}
    }
    
    # Export to ONNX
    print(f"\n📤 Exporting to ONNX format...")
    print(f"   Output file: {ONNX_MODEL_PATH}")
    
    try:
        torch.onnx.export(
            model,
            (inputs['input_ids'], inputs['attention_mask']),
            ONNX_MODEL_PATH,
            input_names=input_names,
            output_names=output_names,
            dynamic_axes=dynamic_axes,
            opset_version=14,
            do_constant_folding=True,
            export_params=True,
        )
        print("✅ ONNX export successful!")
    except Exception as e:
        print(f"❌ Error during ONNX export: {e}")
        return
    
    # Save tokenizer files
    print("\n💾 Saving tokenizer files...")
    try:
        tokenizer.save_pretrained(OUTPUT_DIR)
        print("✅ Tokenizer saved successfully")
    except Exception as e:
        print(f"❌ Error saving tokenizer: {e}")
        return
    
    # Save label mapping
    print("\n🏷️  Saving label mapping...")
    label_map = {
        "0": "O",
        "1": "B-EMAIL",
        "2": "I-EMAIL",
        "3": "B-PHONE",
        "4": "I-PHONE",
        "5": "B-PER",
        "6": "I-PER",
        "7": "B-LOC",
        "8": "I-LOC"
    }
    
    import json
    label_map_path = os.path.join(OUTPUT_DIR, "label_map.json")
    with open(label_map_path, 'w') as f:
        json.dump(label_map, f, indent=2)
    print(f"✅ Label map saved to: {label_map_path}")
    
    # Get file sizes
    print("\n📊 Export Summary")
    print("=" * 60)
    
    onnx_size = os.path.getsize(ONNX_MODEL_PATH) / (1024 * 1024)  # MB
    print(f"ONNX Model Size: {onnx_size:.2f} MB")
    
    # List all files in output directory
    print(f"\n📁 Files in {OUTPUT_DIR}:")
    for file in sorted(os.listdir(OUTPUT_DIR)):
        file_path = os.path.join(OUTPUT_DIR, file)
        if os.path.isfile(file_path):
            size = os.path.getsize(file_path) / (1024 * 1024)
            print(f"   - {file}: {size:.2f} MB")
    
    print("\n" + "=" * 60)
    print("✅ ONNX Export Complete!")
    print("=" * 60)
    
    # Recommendations
    print("\n💡 Next Steps:")
    if onnx_size > 40:
        print(f"   ⚠️  Model size ({onnx_size:.2f} MB) exceeds 40MB target")
        print("   → Consider quantization to reduce size")
    else:
        print(f"   ✅ Model size ({onnx_size:.2f} MB) is within target")
    
    print("\n   1. Test ONNX model with onnxruntime")
    print("   2. Integrate into Chrome extension")
    print("   3. Validate inference performance")

if __name__ == "__main__":
    export_to_onnx()
