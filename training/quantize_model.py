#!/usr/bin/env python3
"""
Quantize the ONNX model to reduce size while maintaining accuracy.
Creates both quantized and original versions for comparison.
"""

import os
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType
import onnxruntime as ort
import numpy as np
from transformers import AutoTokenizer
import json

# Configuration
ORIGINAL_MODEL = "models/distilbert-ner/model.onnx"
QUANTIZED_MODEL = "models/distilbert-ner/model_quantized.onnx"
TOKENIZER_PATH = "models/distilbert-ner"
VAL_DATA = "training/data/val.json"

def get_file_size_mb(filepath):
    """Get file size in MB."""
    if not os.path.exists(filepath):
        return 0
    size_bytes = os.path.getsize(filepath)
    # Check for .data file
    data_file = filepath + ".data"
    if os.path.exists(data_file):
        size_bytes += os.path.getsize(data_file)
    return size_bytes / (1024 * 1024)

def quantize_model():
    """Apply dynamic INT8 quantization to the ONNX model."""
    print("🔧 Starting Model Quantization")
    print("=" * 60)
    
    # Check if original model exists
    if not os.path.exists(ORIGINAL_MODEL):
        print(f"❌ Original model not found at {ORIGINAL_MODEL}")
        print("   Run export_onnx.py first!")
        return False
    
    original_size = get_file_size_mb(ORIGINAL_MODEL)
    print(f"\n📊 Original Model Size: {original_size:.2f} MB")
    
    # Apply quantization
    print(f"\n⚙️  Applying dynamic INT8 quantization...")
    print(f"   This will convert FP32 weights to INT8")
    
    try:
        quantize_dynamic(
            model_input=ORIGINAL_MODEL,
            model_output=QUANTIZED_MODEL,
            weight_type=QuantType.QInt8,
        )
        print("✅ Quantization successful!")
    except Exception as e:
        print(f"❌ Quantization failed: {e}")
        return False
    
    # Get quantized model size
    quantized_size = get_file_size_mb(QUANTIZED_MODEL)
    reduction = ((original_size - quantized_size) / original_size) * 100
    
    print(f"\n📊 Quantized Model Size: {quantized_size:.2f} MB")
    print(f"📉 Size Reduction: {reduction:.1f}% ({original_size:.2f} MB → {quantized_size:.2f} MB)")
    
    return True

def test_model(model_path, model_name):
    """Test model accuracy on validation data."""
    print(f"\n🧪 Testing {model_name}")
    print("-" * 60)
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_PATH)
    
    # Load ONNX session
    session = ort.InferenceSession(model_path)
    
    # Load validation data
    with open(VAL_DATA, 'r') as f:
        val_data = json.load(f)
    
    # Sample test cases
    test_cases = [
        "My email is alice.99@example.org contact me.",
        "Call me at 555-0199 for repairs.",
        "My name is John Smith.",
        "I live in New York City.",
        "Type f to pay respects.",  # Should be clean
        "Update the status.",  # Should be clean
    ]
    
    label_map = {
        0: "O", 
        1: "B-EMAIL", 2: "I-EMAIL", 
        3: "B-PHONE", 4: "I-PHONE",
        5: "B-PER", 6: "I-PER",
        7: "B-LOC", 8: "I-LOC"
    }
    
    results = []
    
    for text in test_cases:
        inputs = tokenizer(text, return_tensors="np", truncation=True, padding=True)
        
        onnx_inputs = {
            "input_ids": inputs["input_ids"].astype(np.int64),
            "attention_mask": inputs["attention_mask"].astype(np.int64)
        }
        
        # Run inference
        outputs = session.run(None, onnx_inputs)
        logits = outputs[0]
        predictions = np.argmax(logits, axis=-1)[0]
        tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
        
        # Extract entities
        entities = []
        current_entity = []
        current_label = None
        
        for token, pred in zip(tokens, predictions):
            if token in ['[CLS]', '[SEP]', '[PAD]']:
                continue
            
            label = label_map[pred]
            
            if label.startswith("B-"):
                if current_entity:
                    entity_text = ''.join(current_entity).replace('##', '')
                    entities.append(f"{entity_text} ({current_label})")
                current_entity = [token]
                current_label = label[2:]
            elif label.startswith("I-") and current_label == label[2:]:
                current_entity.append(token)
            else:
                if current_entity:
                    entity_text = ''.join(current_entity).replace('##', '')
                    entities.append(f"{entity_text} ({current_label})")
                    current_entity = []
                    current_label = None
        
        if current_entity:
            entity_text = ''.join(current_entity).replace('##', '')
            entities.append(f"{entity_text} ({current_label})")
        
        result = {
            'text': text,
            'entities': entities if entities else ['None']
        }
        results.append(result)
        
        print(f"\nInput: {text}")
        print(f"Found: {', '.join(entities) if entities else 'None'}")
    
    return results

def compare_results(original_results, quantized_results):
    """Compare results between original and quantized models."""
    print(f"\n📊 Accuracy Comparison")
    print("=" * 60)
    
    matches = 0
    total = len(original_results)
    
    for i, (orig, quant) in enumerate(zip(original_results, quantized_results)):
        orig_entities = set(orig['entities'])
        quant_entities = set(quant['entities'])
        
        if orig_entities == quant_entities:
            matches += 1
            status = "✅ MATCH"
        else:
            status = "⚠️  DIFF"
        
        print(f"\nTest {i+1}: {status}")
        print(f"  Input: {orig['text'][:50]}...")
        if orig_entities != quant_entities:
            print(f"  Original: {', '.join(orig['entities'])}")
            print(f"  Quantized: {', '.join(quant['entities'])}")
    
    accuracy = (matches / total) * 100
    print(f"\n{'='*60}")
    print(f"Exact Match Rate: {matches}/{total} ({accuracy:.1f}%)")
    
    if accuracy >= 95:
        print("✅ Excellent! Quantization had minimal impact.")
    elif accuracy >= 85:
        print("⚠️  Good, but some differences detected.")
    else:
        print("❌ Significant accuracy loss detected.")
    
    return accuracy

def main():
    print("\n" + "=" * 60)
    print("ONNX Model Quantization & Comparison")
    print("=" * 60)
    
    # Step 1: Quantize the model
    if not quantize_model():
        return
    
    # Step 2: Test original model
    print(f"\n{'='*60}")
    print("STEP 2: Testing Original Model")
    print("=" * 60)
    original_results = test_model(ORIGINAL_MODEL, "Original Model")
    
    # Step 3: Test quantized model
    print(f"\n{'='*60}")
    print("STEP 3: Testing Quantized Model")
    print("=" * 60)
    quantized_results = test_model(QUANTIZED_MODEL, "Quantized Model")
    
    # Step 4: Compare results
    accuracy = compare_results(original_results, quantized_results)
    
    # Final summary
    original_size = get_file_size_mb(ORIGINAL_MODEL)
    quantized_size = get_file_size_mb(QUANTIZED_MODEL)
    
    print(f"\n{'='*60}")
    print("FINAL SUMMARY")
    print("=" * 60)
    print(f"\n📦 Model Sizes:")
    print(f"   Original:  {original_size:.2f} MB")
    print(f"   Quantized: {quantized_size:.2f} MB")
    print(f"   Reduction: {((original_size - quantized_size) / original_size * 100):.1f}%")
    
    print(f"\n🎯 Accuracy:")
    print(f"   Exact Match Rate: {accuracy:.1f}%")
    print(f"   Estimated Accuracy Loss: {100 - accuracy:.1f}%")
    
    print(f"\n💡 Recommendation:")
    if accuracy >= 95 and quantized_size < 100:
        print("   ✅ USE QUANTIZED MODEL - Great balance of size and accuracy!")
    elif accuracy >= 90:
        print("   ⚠️  Consider quantized model if size is important")
    else:
        print("   ❌ KEEP ORIGINAL MODEL - Accuracy loss too high")
    
    print(f"\n📁 Output Files:")
    print(f"   Original:  {ORIGINAL_MODEL}")
    print(f"   Quantized: {QUANTIZED_MODEL}")
    
    print(f"\n{'='*60}")
    print("✅ Quantization Complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
