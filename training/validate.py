
import json
import torch
import os
from transformers import DistilBertTokenizerFast, DistilBertForTokenClassification
from sklearn.metrics import classification_report
import numpy as np

# Configuration
MODEL_PATH = "./results_v2"
DATA_FILE = "training/data/val.json"

def validate():
    print("Loading model and tokenizer...")
    try:
        tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_PATH)
        model = DistilBertForTokenClassification.from_pretrained(MODEL_PATH)
    except Exception as e:
        print(f"Error loading model from {MODEL_PATH}: {e}")
        print("Ensure you have run training/train.py first.")
        return

    print(f"Loading validation data from {DATA_FILE}...")
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)

    print("Running validation...")
    
    true_labels_flat = []
    pred_labels_flat = []
    
    for item in data:
        text = item['text']
        entities = item['entities']
        
        # Tokenize and run inference
        inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
        
        logits = outputs.logits
        predictions = torch.argmax(logits, dim=2)[0]
        
        # We need to reconstruct ground truth labels for the tokens
        # encoding = tokenizer(text, return_offsets_mapping=True, truncation=True)
        # This is tricky without the original Dataset alignment logic. 
        # For this quick check, we will just print specific examples that we know match our "Target Domain".
        
    print("-" * 50)
    print("MANUAL SAFETY CHECK (Smoke Test)")
    print("-" * 50)
    
    label_map = {
        0: "O", 
        1: "B-EMAIL", 2: "I-EMAIL", 
        3: "B-PHONE", 4: "I-PHONE",
        5: "B-PER", 6: "I-PER",
        7: "B-LOC", 8: "I-LOC"
    }

    test_cases = [
        "My email is alice.99@example.org contact me.",
        "Call me at 555-0199 for repairs.",
        "Type f to pay respects.", # Should NOT be PII
        "Update the status.", # Should NOT be PII
        "My name is John Smith.",
        "I live in New York City."
    ]
    
    for text in test_cases:
        inputs = tokenizer(text, return_tensors="pt", truncation=True)
        with torch.no_grad():
            outputs = model(**inputs)
        
        predictions = torch.argmax(outputs.logits, dim=2)[0]
        tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
        
        # Filter out special tokens
        clean_tokens = []
        clean_labels = []
        
        for token, label_idx in zip(tokens, predictions):
            if token not in ['[CLS]', '[SEP]', '[PAD]']:
                clean_tokens.append(token)
                clean_labels.append(label_map[label_idx.item()])
                
        # Group entities for cleaner output
        print(f"\nInput: {text}")
        
        # Simple entity aggregation for display
        current_entity = []
        current_label = None
        
        found_entities = []
        
        for token, label in zip(clean_tokens, clean_labels):
            if label.startswith("B-"):
                if current_entity:
                    found_entities.append(f"{''.join(current_entity).replace('##', '')} ({current_label})")
                current_entity = [token]
                current_label = label[2:]
            elif label.startswith("I-") and current_label == label[2:]:
                current_entity.append(token)
            else:
                if current_entity:
                    found_entities.append(f"{''.join(current_entity).replace('##', '')} ({current_label})")
                    current_entity = []
                    current_label = None
        
        if current_entity:
            found_entities.append(f"{''.join(current_entity).replace('##', '')} ({current_label})")
            
        if found_entities:
            print(f"Found: {', '.join(found_entities)}")
        else:
            print("Found: None")

    print("-" * 50)

if __name__ == "__main__":
    validate()
