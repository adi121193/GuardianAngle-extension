
import os
import json
import torch
from transformers import DistilBertTokenizerFast, DistilBertForTokenClassification, Trainer, TrainingArguments
from torch.utils.data import Dataset

# Configuration
MODEL_NAME = "distilbert-base-cased"
OUTPUT_DIR = "./results_v2"
LOG_DIR = "./logs_v2"
DATA_DIR = "training/data"

class NERDataset(Dataset):
    def __init__(self, data_path, tokenizer, max_len=128):
        with open(data_path, 'r') as f:
            self.data = json.load(f)
        self.tokenizer = tokenizer
        self.max_len = max_len
        
        # Label mapping (Simplified for demo)
        self.label2id = {
            "O": 0, 
            "B-EMAIL": 1, "I-EMAIL": 2, 
            "B-PHONE": 3, "I-PHONE": 4,
            "B-PER": 5, "I-PER": 6,
            "B-LOC": 7, "I-LOC": 8
        }
        self.id2label = {v: k for k, v in self.label2id.items()}

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        text = item['text']
        entities = item['entities']
        
        # Tokenize
        encoding = self.tokenizer(text, return_offsets_mapping=True, padding='max_length', truncation=True, max_length=self.max_len)
        labels = [self.label2id["O"]] * len(encoding["input_ids"])
        
        # Align labels
        # Note: This is a simplified alignment logic. In prod, use standard alignment techniques.
        for start, end, label in entities:
            # Find tokens covering this span
            for i, (offset_start, offset_end) in enumerate(encoding["offset_mapping"]):
                if offset_end == 0: continue
                if offset_start >= start and offset_end <= end:
                    labels[i] = self.label2id[f"B-{label}"] if offset_start == start else self.label2id[f"I-{label}"]
                    # Fix B- tag for subsequent tokens if simplified
                    if labels[i-1] == self.label2id[f"B-{label}"] and offset_start > start:
                         labels[i] = self.label2id[f"I-{label}"]

        item = {key: torch.as_tensor(val) for key, val in encoding.items() if key != 'offset_mapping'}
        item['labels'] = torch.as_tensor(labels)
        
        return item

def train():
    print(f"🚀 Starting NER Model Training (v2 - Enhanced Dataset)")
    print(f"Model: {MODEL_NAME}")
    print(f"Output: {OUTPUT_DIR}\n")
    
    print(f"Loading model: {MODEL_NAME}")
    tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_NAME)
    model = DistilBertForTokenClassification.from_pretrained(MODEL_NAME, num_labels=9)

    print("Loading datasets...")
    # Use merged datasets
    train_dataset = NERDataset(os.path.join(DATA_DIR, "train_merged.json"), tokenizer)
    val_dataset = NERDataset(os.path.join(DATA_DIR, "val_merged.json"), tokenizer)
    
    print(f"✅ Training samples: {len(train_dataset)}")
    print(f"✅ Validation samples: {len(val_dataset)}\n")

    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=5,  # Increased from 3
        per_device_train_batch_size=32,  # Increased from 16
        per_device_eval_batch_size=64,
        warmup_steps=1000,  # Increased from 500
        weight_decay=0.01,
        learning_rate=5e-5,  # Optimized LR
        logging_dir=LOG_DIR,
        logging_steps=50,  # More frequent logging
        eval_strategy="steps",
        eval_steps=500,  # Evaluate every 500 steps
        save_steps=1000,
        save_total_limit=3,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset
    )

    print("Starting training...")
    print("=" * 60)
    trainer.train()
    
    print(f"\n✅ Training complete!")
    print(f"Saving model to {OUTPUT_DIR}")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    print(f"\n💾 Model saved to: {OUTPUT_DIR}")
    print(f"📊 Logs saved to: {LOG_DIR}")

if __name__ == "__main__":
    train()
