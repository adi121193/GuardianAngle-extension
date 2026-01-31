#!/usr/bin/env python3
"""
Debug script to analyze model predictions and tokenization behavior.
Helps identify why the model fails on certain entity types.
"""

import torch
from transformers import AutoTokenizer, AutoModelForTokenClassification
import json

def analyze_predictions():
    print("\n" + "="*60)
    print("MODEL PREDICTION ANALYSIS")
    print("="*60 + "\n")
    
    # Load model and tokenizer
    base_model = "distilbert-base-cased"
    checkpoint_path = "results/checkpoint-300"  # Final checkpoint from training
    
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    model = AutoModelForTokenClassification.from_pretrained(checkpoint_path)
    model.eval()
    
    label_map = {
        0: "O", 
        1: "B-EMAIL", 2: "I-EMAIL", 
        3: "B-PHONE", 4: "I-PHONE",
        5: "B-PER", 6: "I-PER",
        7: "B-LOC", 8: "I-LOC"
    }
    
    # Test cases covering all entity types
    test_cases = [
        ("My email is alice.99@example.org contact me.", "EMAIL", "alice.99@example.org"),
        ("Call me at 555-0199 for repairs.", "PHONE", "555-0199"),
        ("My name is John Smith.", "PERSON", "John Smith"),
        ("I live in New York City.", "LOCATION", "New York City"),
        ("Contact john.85@work.net for details.", "EMAIL", "john.85@work.net"),
        ("Employee-David Thompson", "PERSON", "David Thompson"),
        ("shipping to Berlin.", "LOCATION", "Berlin"),
        ("Mob-751-323-2282", "PHONE", "751-323-2282"),
    ]
    
    for text, expected_type, expected_entity in test_cases:
        print(f"\n{'─'*60}")
        print(f"Input: {text}")
        print(f"Expected: {expected_entity} ({expected_type})")
        print(f"{'─'*60}")
        
        # Tokenize
        inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
        tokens = tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])
        
        print(f"\nTokens: {tokens}")
        
        # Get predictions
        with torch.no_grad():
            outputs = model(**inputs)
            predictions = torch.argmax(outputs.logits, dim=-1)[0]
            probabilities = torch.softmax(outputs.logits, dim=-1)[0]
        
        # Analyze each token
        print(f"\nToken-level predictions:")
        print(f"{'Token':<20} {'Predicted':<12} {'Confidence':<12} {'Top-3 Probs'}")
        print(f"{'-'*60}")
        
        for i, (token, pred_id) in enumerate(zip(tokens, predictions)):
            pred_label = label_map[pred_id.item()]
            confidence = probabilities[i][pred_id].item()
            
            # Get top 3 predictions
            top3_probs, top3_indices = torch.topk(probabilities[i], 3)
            top3_labels = [label_map[idx.item()] for idx in top3_indices]
            top3_str = ", ".join([f"{lbl}:{prob:.2f}" for lbl, prob in zip(top3_labels, top3_probs)])
            
            print(f"{token:<20} {pred_label:<12} {confidence:<12.3f} {top3_str}")
        
        # Extract predicted entities
        predicted_entities = []
        current_entity = None
        current_tokens = []
        
        for i, (token, pred_id) in enumerate(zip(tokens, predictions)):
            if token in ['[CLS]', '[SEP]', '[PAD]']:
                continue
            
            pred_label = label_map[pred_id.item()]
            
            if pred_label.startswith('B-'):
                if current_entity:
                    predicted_entities.append((current_entity, current_tokens))
                current_entity = pred_label[2:]
                current_tokens = [token]
            elif pred_label.startswith('I-') and current_entity:
                current_tokens.append(token)
            else:
                if current_entity:
                    predicted_entities.append((current_entity, current_tokens))
                    current_entity = None
                    current_tokens = []
        
        if current_entity:
            predicted_entities.append((current_entity, current_tokens))
        
        print(f"\nExtracted Entities:")
        if predicted_entities:
            for entity_type, entity_tokens in predicted_entities:
                entity_text = tokenizer.convert_tokens_to_string(entity_tokens)
                print(f"  ✓ {entity_text} ({entity_type})")
        else:
            print(f"  ✗ None detected")
        
        # Check if correct
        if predicted_entities:
            found_correct = any(
                expected_entity.lower() in tokenizer.convert_tokens_to_string(tokens).lower()
                and entity_type.upper() in expected_type.upper()
                for entity_type, tokens in predicted_entities
            )
            if found_correct:
                print(f"\n✅ CORRECT")
            else:
                print(f"\n❌ INCORRECT - Wrong entity detected")
        else:
            print(f"\n❌ INCORRECT - Nothing detected")
    
    # Check model configuration
    print(f"\n{'='*60}")
    print(f"MODEL CONFIGURATION")
    print(f"{'='*60}\n")
    print(f"Model path: {checkpoint_path}")
    print(f"Number of labels: {model.config.num_labels}")
    print(f"Label mapping: {label_map}")
    print(f"Vocab size: {tokenizer.vocab_size}")
    
    # Check if model was actually trained
    print(f"\n{'='*60}")
    print(f"TRAINING VERIFICATION")
    print(f"{'='*60}\n")
    
    # Check classifier weights
    classifier_weight = model.classifier.weight.data
    print(f"Classifier weight shape: {classifier_weight.shape}")
    print(f"Classifier weight mean: {classifier_weight.mean().item():.6f}")
    print(f"Classifier weight std: {classifier_weight.std().item():.6f}")
    
    # Check if weights are initialized (close to zero) or trained
    if abs(classifier_weight.mean().item()) < 0.01 and classifier_weight.std().item() < 0.1:
        print(f"\n⚠️  WARNING: Classifier weights appear to be randomly initialized!")
        print(f"   This suggests the model may not have trained properly.")
    else:
        print(f"\n✅ Classifier weights appear to be trained.")

if __name__ == "__main__":
    analyze_predictions()
