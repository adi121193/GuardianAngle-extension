"""
Data Quality Analysis Script
Analyzes the generated NER dataset for quality metrics.
"""

import json
import random
from collections import Counter, defaultdict

def load_dataset(filepath):
    """Load dataset from JSON"""
    with open(filepath, 'r') as f:
        return json.load(f)

def analyze_dataset(data, name="Dataset"):
    """Comprehensive quality analysis"""
    print(f"\n{'='*60}")
    print(f"📊 {name} Quality Analysis")
    print(f"{'='*60}\n")
    
    # Basic stats
    print(f"📈 Basic Statistics:")
    print(f"  Total samples: {len(data)}")
    
    # Entity type distribution
    entity_types = Counter()
    entity_lengths = defaultdict(list)
    samples_with_entities = 0
    samples_without_entities = 0
    total_entities = 0
    
    for sample in data:
        entities = sample.get('entities', [])
        if entities:
            samples_with_entities += 1
            total_entities += len(entities)
            for start, end, label in entities:
                entity_types[label] += 1
                entity_lengths[label].append(end - start)
        else:
            samples_without_entities += 1
    
    print(f"  Samples with PII: {samples_with_entities} ({samples_with_entities/len(data)*100:.1f}%)")
    print(f"  Samples without PII: {samples_without_entities} ({samples_without_entities/len(data)*100:.1f}%)")
    print(f"  Total entities: {total_entities}")
    print(f"  Avg entities per sample: {total_entities/len(data):.2f}")
    
    # Entity type distribution
    print(f"\n🏷️  Entity Type Distribution:")
    for entity_type, count in entity_types.most_common():
        percentage = count / total_entities * 100
        avg_length = sum(entity_lengths[entity_type]) / len(entity_lengths[entity_type])
        print(f"  {entity_type:10s}: {count:5d} ({percentage:5.1f}%) | Avg length: {avg_length:.1f} chars")
    
    # Text length analysis
    text_lengths = [len(sample['text']) for sample in data]
    print(f"\n📏 Text Length Statistics:")
    print(f"  Min: {min(text_lengths)} chars")
    print(f"  Max: {max(text_lengths)} chars")
    print(f"  Avg: {sum(text_lengths)/len(text_lengths):.1f} chars")
    print(f"  Median: {sorted(text_lengths)[len(text_lengths)//2]} chars")
    
    # Template diversity (check for duplicates)
    unique_texts = len(set(sample['text'] for sample in data))
    print(f"\n🎨 Template Diversity:")
    print(f"  Unique texts: {unique_texts} / {len(data)} ({unique_texts/len(data)*100:.1f}%)")
    
    # Sample quality checks
    print(f"\n✅ Quality Checks:")
    
    # Check for empty texts
    empty_texts = sum(1 for s in data if not s['text'].strip())
    print(f"  Empty texts: {empty_texts}")
    
    # Check for malformed entities
    malformed = 0
    for sample in data:
        text = sample['text']
        for start, end, label in sample.get('entities', []):
            if start < 0 or end > len(text) or start >= end:
                malformed += 1
    print(f"  Malformed entities: {malformed}")
    
    # Check entity label validity
    valid_labels = {'EMAIL', 'PHONE', 'PER', 'LOC', 'ORG'}
    invalid_labels = set()
    for sample in data:
        for start, end, label in sample.get('entities', []):
            if label not in valid_labels:
                invalid_labels.add(label)
    print(f"  Invalid labels: {len(invalid_labels)} types: {invalid_labels if invalid_labels else 'None'}")
    
    return {
        'total_samples': len(data),
        'samples_with_pii': samples_with_entities,
        'total_entities': total_entities,
        'entity_types': dict(entity_types),
        'unique_texts': unique_texts,
        'quality_issues': empty_texts + malformed + len(invalid_labels)
    }

def show_samples(data, num_samples=10):
    """Show random samples from dataset"""
    print(f"\n{'='*60}")
    print(f"📝 Random Sample Preview ({num_samples} samples)")
    print(f"{'='*60}\n")
    
    samples = random.sample(data, min(num_samples, len(data)))
    
    for i, sample in enumerate(samples, 1):
        text = sample['text']
        entities = sample.get('entities', [])
        
        print(f"Sample {i}:")
        print(f"  Text: {text}")
        
        if entities:
            print(f"  Entities:")
            for start, end, label in entities:
                entity_text = text[start:end]
                print(f"    - {label:10s}: '{entity_text}' (pos {start}-{end})")
        else:
            print(f"  Entities: (none)")
        print()

def main():
    # Analyze all datasets
    train_data = load_dataset("training/data/train_merged.json")
    val_data = load_dataset("training/data/val_merged.json")
    test_data = load_dataset("training/data/test_merged.json")
    
    # Analyze each split
    train_stats = analyze_dataset(train_data, "Training Set")
    val_stats = analyze_dataset(val_data, "Validation Set")
    test_stats = analyze_dataset(test_data, "Test Set")
    
    # Show samples
    show_samples(train_data, num_samples=15)
    
    # Overall quality score
    print(f"\n{'='*60}")
    print(f"🎯 Overall Quality Assessment")
    print(f"{'='*60}\n")
    
    total_issues = (train_stats['quality_issues'] + 
                   val_stats['quality_issues'] + 
                   test_stats['quality_issues'])
    
    total_samples = (train_stats['total_samples'] + 
                    val_stats['total_samples'] + 
                    test_stats['total_samples'])
    
    quality_score = max(0, 100 - (total_issues / total_samples * 100))
    
    print(f"  Quality Score: {quality_score:.1f}/100")
    print(f"  Total Issues: {total_issues}")
    print(f"  Total Samples: {total_samples}")
    
    # Entity balance check
    all_entities = {**train_stats['entity_types']}
    entity_balance = min(all_entities.values()) / max(all_entities.values()) * 100
    print(f"  Entity Balance: {entity_balance:.1f}% (min/max ratio)")
    
    # Recommendations
    print(f"\n💡 Recommendations:")
    if quality_score >= 95:
        print(f"  ✅ Excellent quality! Ready for training.")
    elif quality_score >= 85:
        print(f"  ✅ Good quality. Minor issues detected but acceptable.")
    elif quality_score >= 70:
        print(f"  ⚠️  Moderate quality. Consider reviewing issues.")
    else:
        print(f"  ❌ Poor quality. Regenerate dataset recommended.")
    
    if entity_balance < 30:
        print(f"  ⚠️  Entity imbalance detected. Consider balancing EMAIL/PHONE/PER/LOC.")
    
    if train_stats['unique_texts'] / train_stats['total_samples'] < 0.9:
        print(f"  ⚠️  Low template diversity. Consider adding more templates.")

if __name__ == "__main__":
    main()
