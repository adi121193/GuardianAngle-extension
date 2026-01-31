"""
Dataset Merging Script
Combines multiple datasets into unified train/val/test splits.
"""

import json
import random
import os

DATA_DIR = "training/data"

def load_json(filepath):
    """Load JSON file"""
    if not os.path.exists(filepath):
        print(f"⚠️  File not found: {filepath}")
        return []
    
    with open(filepath, 'r') as f:
        data = json.load(f)
    print(f"✅ Loaded {len(data)} samples from {os.path.basename(filepath)}")
    return data

def save_json(data, filepath):
    """Save JSON file"""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"💾 Saved {len(data)} samples to {filepath}")

def merge_datasets():
    """Merge all available datasets"""
    print("🔄 Merging datasets...\n")
    
    # Load all datasets
    synthetic_train = load_json(os.path.join(DATA_DIR, "train_synthetic_v2.json"))
    synthetic_val = load_json(os.path.join(DATA_DIR, "val_synthetic_v2.json"))
    
    # CoNLL data (if available)
    conll_train = load_json(os.path.join(DATA_DIR, "train_conll.json"))
    conll_val = load_json(os.path.join(DATA_DIR, "val_conll.json"))
    
    # Old synthetic data (if exists)
    old_train = load_json(os.path.join(DATA_DIR, "train.json"))
    old_val = load_json(os.path.join(DATA_DIR, "val.json"))
    
    # Combine all training data
    all_train = synthetic_train + conll_train + old_train
    all_val = synthetic_val + conll_val + old_val
    
    print(f"\n📊 Dataset Statistics:")
    print(f"  Synthetic v2: {len(synthetic_train)} train, {len(synthetic_val)} val")
    print(f"  CoNLL 2003: {len(conll_train)} train, {len(conll_val)} val")
    print(f"  Old synthetic: {len(old_train)} train, {len(old_val)} val")
    print(f"  TOTAL: {len(all_train)} train, {len(all_val)} val")
    
    # Shuffle
    random.shuffle(all_train)
    random.shuffle(all_val)
    
    # Create test split from validation (20% of val)
    test_size = int(len(all_val) * 0.2)
    test_data = all_val[:test_size]
    val_data = all_val[test_size:]
    
    print(f"\n📦 Final splits:")
    print(f"  Train: {len(all_train)} samples")
    print(f"  Val: {len(val_data)} samples")
    print(f"  Test: {len(test_data)} samples")
    
    # Save merged datasets
    save_json(all_train, os.path.join(DATA_DIR, "train_merged.json"))
    save_json(val_data, os.path.join(DATA_DIR, "val_merged.json"))
    save_json(test_data, os.path.join(DATA_DIR, "test_merged.json"))
    
    # Show sample
    print(f"\n📝 Sample from merged dataset:")
    sample = random.choice(all_train)
    print(f"Text: {sample['text']}")
    print(f"Entities: {sample['entities']}")
    
    return all_train, val_data, test_data

if __name__ == "__main__":
    merge_datasets()
    print("\n✅ Dataset merging complete!")
