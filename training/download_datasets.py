"""
Dataset Download Script
Downloads and caches datasets from Hugging Face for NER training.
"""

import argparse
from datasets import load_dataset
import os
import json

def download_census_dataset():
    """Download CENSUS-NER dataset"""
    print("📥 Downloading CENSUS-NER dataset...")
    try:
        dataset = load_dataset("CENSUS/CENSUS-NER-Name-Email-Address-Phone")
        print(f"✅ CENSUS dataset loaded: {len(dataset['train'])} samples")
        print(f"Sample: {dataset['train'][0]}")
        return dataset
    except Exception as e:
        print(f"❌ Failed to load CENSUS dataset: {e}")
        print("Note: This dataset may require authentication or may not exist.")
        return None

def download_conll_dataset():
    """Download CoNLL 2003 dataset"""
    print("\n📥 Downloading CoNLL 2003 dataset...")
    try:
        dataset = load_dataset("conll2003")
        print(f"✅ CoNLL 2003 loaded: {len(dataset['train'])} samples")
        print(f"Sample: {dataset['train'][0]}")
        return dataset
    except Exception as e:
        print(f"❌ Failed to load CoNLL dataset: {e}")
        return None

def save_dataset_info(dataset, name, output_dir="training/data"):
    """Save dataset metadata"""
    os.makedirs(output_dir, exist_ok=True)
    
    info = {
        "name": name,
        "splits": list(dataset.keys()),
        "num_samples": {split: len(dataset[split]) for split in dataset.keys()},
        "features": str(dataset['train'].features) if 'train' in dataset else None
    }
    
    info_path = os.path.join(output_dir, f"{name}_info.json")
    with open(info_path, 'w') as f:
        json.dump(info, f, indent=2)
    
    print(f"💾 Saved dataset info to {info_path}")

def main():
    parser = argparse.ArgumentParser(description="Download NER datasets from Hugging Face")
    parser.add_argument("--dataset", choices=["census", "conll", "all"], default="all",
                        help="Which dataset to download")
    parser.add_argument("--output", default="training/data", help="Output directory")
    
    args = parser.parse_args()
    
    print("🚀 Starting dataset download...\n")
    
    if args.dataset in ["census", "all"]:
        census = download_census_dataset()
        if census:
            save_dataset_info(census, "census", args.output)
    
    if args.dataset in ["conll", "all"]:
        conll = download_conll_dataset()
        if conll:
            save_dataset_info(conll, "conll", args.output)
    
    print("\n✅ Dataset download complete!")
    print(f"Datasets cached in: ~/.cache/huggingface/datasets/")

if __name__ == "__main__":
    main()
