#!/usr/bin/env python3
"""
Validate quantized model accuracy
Phase 1.4: Validate quantization accuracy
"""

from pathlib import Path
import json
import numpy as np
from optimum.onnxruntime import ORTModelForTokenClassification
from transformers import AutoTokenizer, pipeline

# Test cases with ground truth
TEST_CASES = [
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
    },
    {
        "text": "Dr. Sarah Johnson from the World Health Organization visited Paris last week.",
        "expected_entities": [
            {"type": "PER", "value": "Sarah Johnson"},
            {"type": "ORG", "value": "World Health Organization"},
            {"type": "LOC", "value": "Paris"}
        ]
    },
    {
        "text": "Apple Inc. headquarters is in Cupertino, California. Tim Cook is the CEO.",
        "expected_entities": [
            {"type": "ORG", "value": "Apple Inc."},
            {"type": "LOC", "value": "Cupertino"},
            {"type": "LOC", "value": "California"},
            {"type": "PER", "value": "Tim Cook"}
        ]
    }
]

def calculate_metrics(detected, expected):
    """Calculate precision, recall, F1 for detected entities"""

    detected_types = set(e['entity_group'] for e in detected)
    expected_types = set(e['type'] for e in expected)

    if not detected_types:
        return 0.0, 0.0, 0.0

    # Type-level metrics
    true_positives = detected_types & expected_types
    precision = len(true_positives) / len(detected_types) if detected_types else 0
    recall = len(true_positives) / len(expected_types) if expected_types else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    return precision, recall, f1

def validate_model(model_path, model_name):
    """Validate a single model"""

    print("=" * 70)
    print(f"Validating: {model_name}")
    print("=" * 70)
    print(f"Path: {model_path}")
    print()

    # Check if model exists
    model_file = Path(model_path) / 'model.onnx'
    if not model_file.exists():
        # Try alternate name
        model_file = Path(model_path) / 'model_quantized.onnx'

    if not model_file.exists():
        print(f"❌ Model not found at {model_path}")
        return None

    # Load model and tokenizer
    print("Loading model...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = ORTModelForTokenClassification.from_pretrained(model_path)
        ner = pipeline('ner', model=model, tokenizer=tokenizer, aggregation_strategy='simple')
        print("✅ Model loaded successfully")
        print()
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return None

    # Run tests
    results = []
    all_precisions = []
    all_recalls = []
    all_f1s = []

    for i, test in enumerate(TEST_CASES, 1):
        print(f"Test {i}/{len(TEST_CASES)}: {test['text'][:50]}...")

        try:
            entities = ner(test['text'])

            print(f"  Expected: {len(test['expected_entities'])} entities")
            print(f"  Detected: {len(entities)} entities")

            if entities:
                for ent in entities:
                    print(f"    - {ent['entity_group']:4s}: '{ent['word']:20s}' (score: {ent['score']:.3f})")

            # Calculate metrics
            precision, recall, f1 = calculate_metrics(entities, test['expected_entities'])

            all_precisions.append(precision)
            all_recalls.append(recall)
            all_f1s.append(f1)

            print(f"  Metrics: P={precision:.3f}, R={recall:.3f}, F1={f1:.3f}")
            print()

            results.append({
                'test': i,
                'precision': precision,
                'recall': recall,
                'f1': f1,
                'entities': entities
            })

        except Exception as e:
            print(f"  ❌ Test failed: {e}")
            print()

    # Overall metrics
    avg_precision = np.mean(all_precisions)
    avg_recall = np.mean(all_recalls)
    avg_f1 = np.mean(all_f1s)

    print("=" * 70)
    print(f"Overall Performance ({model_name}):")
    print("=" * 70)
    print(f"  Average Precision: {avg_precision:.3f}")
    print(f"  Average Recall:    {avg_recall:.3f}")
    print(f"  Average F1:        {avg_f1:.3f}")

    # Check if meets requirements
    target_f1 = 0.85
    if avg_f1 >= target_f1:
        print(f"  ✅ PASS - F1 {avg_f1:.3f} >= {target_f1:.3f}")
    else:
        print(f"  ❌ FAIL - F1 {avg_f1:.3f} < {target_f1:.3f}")

    print("=" * 70)
    print()

    return {
        'precision': avg_precision,
        'recall': avg_recall,
        'f1': avg_f1,
        'results': results
    }

def main():
    print("=" * 70)
    print("PII Guardian - Model Accuracy Validation")
    print("=" * 70)
    print()

    # Validate all available models
    models_to_test = [
        ('./distilbert-ner-onnx', 'Original FP32'),
        ('./distilbert-ner-int8', 'INT8 Quantized'),
        ('./distilbert-ner-uint4', 'UINT4 Quantized')
    ]

    validation_results = {}

    for model_path, model_name in models_to_test:
        if not Path(model_path).exists():
            print(f"Skipping {model_name} (directory not found)")
            print()
            continue

        result = validate_model(model_path, model_name)
        if result:
            validation_results[model_name] = result

    # Comparison analysis
    if len(validation_results) > 1:
        print("\n" + "=" * 70)
        print("Quantization Impact Analysis")
        print("=" * 70)

        baseline_f1 = validation_results.get('Original FP32', {}).get('f1', 0)
        int8_f1 = validation_results.get('INT8 Quantized', {}).get('f1', 0)
        uint4_f1 = validation_results.get('UINT4 Quantized', {}).get('f1', 0)

        print(f"Original FP32:     F1 = {baseline_f1:.3f}")

        if int8_f1 > 0:
            degradation_int8 = baseline_f1 - int8_f1
            print(f"INT8 Quantized:    F1 = {int8_f1:.3f} (degradation: {degradation_int8:+.3f})")

            if abs(degradation_int8) < 0.03:
                print(f"  ✅ INT8 acceptable (<3% degradation)")
            else:
                print(f"  ⚠️  INT8 degradation too high (>3%)")

        if uint4_f1 > 0:
            degradation_uint4 = baseline_f1 - uint4_f1
            print(f"UINT4 Quantized:   F1 = {uint4_f1:.3f} (degradation: {degradation_uint4:+.3f})")

            if abs(degradation_uint4) < 0.05:
                print(f"  ✅ UINT4 acceptable (<5% degradation)")
            else:
                print(f"  ⚠️  UINT4 degradation too high (>5%)")

        print()

    # Recommendation
    print("=" * 70)
    print("Recommendation:")
    print("=" * 70)

    if int8_f1 >= 0.85 and abs(baseline_f1 - int8_f1) < 0.03:
        print("✅ INT8 quantization is RECOMMENDED")
        print("   - Meets accuracy requirements (F1 ≥ 0.85)")
        print("   - Low degradation (<3%)")
        print("   - Good balance of size/accuracy")
        print()
        print("   Use: ./distilbert-ner-int8/")
    elif uint4_f1 >= 0.85 and abs(baseline_f1 - uint4_f1) < 0.05:
        print("⚠️  UINT4 quantization is ACCEPTABLE")
        print("   - Meets accuracy requirements (F1 ≥ 0.85)")
        print("   - Moderate degradation (<5%)")
        print("   - Best size, acceptable accuracy")
        print()
        print("   Use: ./distilbert-ner-uint4/")
    else:
        print("⚠️  Consider using FP32 (no quantization)")
        print("   - Quantized models don't meet requirements")
        print()
        print("   Use: ./distilbert-ner-onnx/")

    print("=" * 70)

    # Save results
    results_file = Path('./validation_results.json')
    with open(results_file, 'w') as f:
        # Convert to JSON-serializable format
        serializable_results = {}
        for model_name, result in validation_results.items():
            serializable_results[model_name] = {
                'precision': float(result['precision']),
                'recall': float(result['recall']),
                'f1': float(result['f1'])
            }

        json.dump(serializable_results, f, indent=2)

    print(f"\n✅ Validation results saved to {results_file}")

if __name__ == '__main__':
    main()
