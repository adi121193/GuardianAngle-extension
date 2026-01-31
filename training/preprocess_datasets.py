"""
Dataset Preprocessing Script
Converts various NER datasets to unified JSON format for training.
"""

import json
import os
from datasets import load_dataset

OUTPUT_DIR = "training/data"

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def extract_entities_from_bio(tokens, ner_tags, id2label):
    """
    Extract entities from BIO-tagged tokens.
    
    Args:
        tokens: List of word tokens
        ner_tags: List of NER tag IDs
        id2label: Mapping from tag ID to label name
    
    Returns:
        List of [start, end, label] tuples
    """
    entities = []
    current_entity = None
    current_start = 0
    text_position = 0
    
    for i, (token, tag_id) in enumerate(zip(tokens, ner_tags)):
        tag = id2label[tag_id]
        token_start = text_position
        token_end = text_position + len(token)
        
        if tag.startswith('B-'):
            # Start of new entity
            if current_entity:
                entities.append(current_entity)
            
            label = tag[2:]  # Remove 'B-' prefix
            current_entity = [token_start, token_end, label]
            current_start = token_start
        
        elif tag.startswith('I-'):
            # Continuation of entity
            if current_entity:
                label = tag[2:]
                # Extend entity end position
                current_entity[1] = token_end
        
        else:  # 'O' tag
            # End of entity
            if current_entity:
                entities.append(current_entity)
                current_entity = None
        
        # Update position (add space after token)
        text_position = token_end + 1
    
    # Add last entity if exists
    if current_entity:
        entities.append(current_entity)
    
    return entities

def convert_conll_to_pii_format(dataset_split, max_samples=None):
    """
    Convert CoNLL 2003 dataset to our JSON format.
    
    Args:
        dataset_split: Hugging Face dataset split
        max_samples: Maximum number of samples to convert (None = all)
    
    Returns:
        List of {"text": "...", "entities": [[start, end, label]]}
    """
    print(f"Converting CoNLL dataset ({len(dataset_split)} samples)...")
    
    # CoNLL 2003 label mapping
    id2label = {
        0: 'O',
        1: 'B-PER', 2: 'I-PER',
        3: 'B-ORG', 4: 'I-ORG',
        5: 'B-LOC', 6: 'I-LOC',
        7: 'B-MISC', 8: 'I-MISC'
    }
    
    # Filter to only PER and LOC (ignore ORG and MISC for now)
    allowed_labels = {'PER', 'LOC'}
    
    converted_data = []
    
    for idx, sample in enumerate(dataset_split):
        if max_samples and idx >= max_samples:
            break
        
        tokens = sample['tokens']
        ner_tags = sample['ner_tags']
        
        # Reconstruct text with spaces
        text = " ".join(tokens)
        
        # Extract entities
        all_entities = extract_entities_from_bio(tokens, ner_tags, id2label)
        
        # Filter to allowed labels
        filtered_entities = [
            [start, end, label] 
            for start, end, label in all_entities 
            if label in allowed_labels
        ]
        
        # Only include samples with at least one entity
        if filtered_entities:
            converted_data.append({
                "text": text,
                "entities": filtered_entities
            })
    
    print(f"✅ Converted {len(converted_data)} samples with PER/LOC entities")
    return converted_data

def load_and_convert_conll(max_samples_per_split=None):
    """Load CoNLL 2003 and convert to our format"""
    print("\n📥 Loading CoNLL 2003 dataset...")
    
    try:
        # Try new loading method
        dataset = load_dataset("eriktks/conll2003", trust_remote_code=True)
        print(f"✅ Loaded CoNLL 2003: {dataset}")
        
        # Convert train and validation splits
        train_data = convert_conll_to_pii_format(
            dataset['train'], 
            max_samples=max_samples_per_split
        )
        val_data = convert_conll_to_pii_format(
            dataset['validation'], 
            max_samples=max_samples_per_split // 4 if max_samples_per_split else None
        )
        
        return train_data, val_data
    
    except Exception as e:
        print(f"❌ Failed to load CoNLL: {e}")
        return [], []

def main():
    ensure_dir(OUTPUT_DIR)
    
    # Load and convert CoNLL dataset
    conll_train, conll_val = load_and_convert_conll(max_samples_per_split=10000)
    
    if conll_train:
        # Save CoNLL data
        conll_train_path = os.path.join(OUTPUT_DIR, "train_conll.json")
        conll_val_path = os.path.join(OUTPUT_DIR, "val_conll.json")
        
        with open(conll_train_path, 'w') as f:
            json.dump(conll_train, f, indent=2)
        
        with open(conll_val_path, 'w') as f:
            json.dump(conll_val, f, indent=2)
        
        print(f"\n💾 Saved CoNLL data:")
        print(f"  Train: {conll_train_path} ({len(conll_train)} samples)")
        print(f"  Val: {conll_val_path} ({len(conll_val)} samples)")
        
        # Show sample
        print(f"\n📝 Sample CoNLL output:")
        sample = conll_train[0]
        print(f"Text: {sample['text'][:100]}...")
        print(f"Entities: {sample['entities']}")
    
    print("\n✅ Preprocessing complete!")

if __name__ == "__main__":
    main()
