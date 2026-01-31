#!/usr/bin/env python3
"""
Debug script to analyze training data quality and distribution.
Helps identify why the model is underperforming.
"""

import json
from collections import Counter, defaultdict
import re

def analyze_dataset(filepath):
    """Analyze a dataset file and return statistics."""
    print(f"\n{'='*60}")
    print(f"Analyzing: {filepath}")
    print(f"{'='*60}\n")
    
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    total_examples = len(data)
    entity_counts = Counter()
    entity_type_examples = defaultdict(list)
    examples_with_entities = 0
    examples_without_entities = 0
    
    # Track specific patterns
    email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    phone_pattern = re.compile(r'\d{3}[-.]?\d{3}[-.]?\d{4}')
    
    emails_in_text = 0
    phones_in_text = 0
    emails_labeled = 0
    phones_labeled = 0
    
    for item in data:
        text = item['text']
        entities = item['entities']
        
        # Check if text contains patterns
        if email_pattern.search(text):
            emails_in_text += 1
        if phone_pattern.search(text):
            phones_in_text += 1
        
        if entities:
            examples_with_entities += 1
            for entity in entities:
                start, end, label = entity
                entity_counts[label] += 1
                
                # Track if labeled
                if label == 'EMAIL':
                    emails_labeled += 1
                elif label == 'PHONE':
                    phones_labeled += 1
                
                # Store example
                if len(entity_type_examples[label]) < 5:
                    entity_text = text[start:end]
                    entity_type_examples[label].append({
                        'text': text,
                        'entity': entity_text,
                        'span': (start, end)
                    })
        else:
            examples_without_entities += 1
    
    # Print statistics
    print(f"📊 DATASET STATISTICS")
    print(f"-" * 60)
    print(f"Total examples: {total_examples}")
    print(f"Examples with entities: {examples_with_entities} ({examples_with_entities/total_examples*100:.1f}%)")
    print(f"Examples without entities: {examples_without_entities} ({examples_without_entities/total_examples*100:.1f}%)")
    
    print(f"\n📈 ENTITY TYPE DISTRIBUTION")
    print(f"-" * 60)
    for entity_type, count in entity_counts.most_common():
        percentage = count / sum(entity_counts.values()) * 100
        print(f"{entity_type:10s}: {count:5d} ({percentage:5.1f}%)")
    
    print(f"\n🔍 PATTERN DETECTION vs LABELING")
    print(f"-" * 60)
    print(f"Emails found in text: {emails_in_text}")
    print(f"Emails labeled: {emails_labeled}")
    print(f"Unlabeled emails: {emails_in_text - emails_labeled}")
    print(f"\nPhones found in text: {phones_in_text}")
    print(f"Phones labeled: {phones_labeled}")
    print(f"Unlabeled phones: {phones_in_text - phones_labeled}")
    
    print(f"\n📝 SAMPLE ENTITIES BY TYPE")
    print(f"-" * 60)
    for entity_type, examples in entity_type_examples.items():
        print(f"\n{entity_type}:")
        for i, ex in enumerate(examples[:3], 1):
            print(f"  {i}. \"{ex['entity']}\" in: \"{ex['text'][:60]}...\"")
    
    # Check for potential issues
    print(f"\n⚠️  POTENTIAL ISSUES")
    print(f"-" * 60)
    
    if emails_in_text - emails_labeled > 100:
        print(f"❌ Many unlabeled emails detected ({emails_in_text - emails_labeled} instances)")
    
    if phones_in_text - phones_labeled > 100:
        print(f"❌ Many unlabeled phones detected ({phones_in_text - phones_labeled} instances)")
    
    # Check for class imbalance
    if entity_counts:
        max_count = max(entity_counts.values())
        min_count = min(entity_counts.values())
        if max_count / min_count > 10:
            print(f"❌ Severe class imbalance detected (ratio: {max_count/min_count:.1f}:1)")
    
    # Check for too many negative examples
    if examples_without_entities / total_examples > 0.5:
        print(f"⚠️  High ratio of negative examples ({examples_without_entities/total_examples*100:.1f}%)")
    
    return {
        'total': total_examples,
        'entity_counts': entity_counts,
        'emails_in_text': emails_in_text,
        'emails_labeled': emails_labeled,
        'phones_in_text': phones_in_text,
        'phones_labeled': phones_labeled
    }

if __name__ == "__main__":
    train_stats = analyze_dataset("training/data/train_merged.json")
    val_stats = analyze_dataset("training/data/val_merged.json")
    
    print(f"\n{'='*60}")
    print(f"SUMMARY & RECOMMENDATIONS")
    print(f"{'='*60}\n")
    
    # Check if we have enough diversity
    train_entity_types = len(train_stats['entity_counts'])
    if train_entity_types < 4:
        print(f"❌ Limited entity types in training data ({train_entity_types} types)")
        print(f"   → Recommendation: Add more diverse PII types (EMAIL, PHONE, PER, LOC)")
    
    # Check labeling consistency
    if train_stats['emails_in_text'] > train_stats['emails_labeled'] * 1.5:
        print(f"❌ Inconsistent email labeling detected")
        print(f"   → Recommendation: Review and fix email annotations")
    
    if train_stats['phones_in_text'] > train_stats['phones_labeled'] * 1.5:
        print(f"❌ Inconsistent phone labeling detected")
        print(f"   → Recommendation: Review and fix phone annotations")
    
    print(f"\n✅ Analysis complete!")
