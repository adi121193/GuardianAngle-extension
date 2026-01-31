
from transformers import AutoTokenizer
import os

OUTPUT_DIR = "./results"
VOCAB_FILE = "vocab.txt"

def export_vocab():
    print(f"Loading tokenizer from {OUTPUT_DIR}...")
    tokenizer = AutoTokenizer.from_pretrained(OUTPUT_DIR)
    
    output_path = os.path.join(OUTPUT_DIR, VOCAB_FILE)
    print(f"Saving vocabulary to {output_path}...")
    
    # tokenizer.save_vocab(OUTPUT_DIR) # Fails on Fast tokenizer
    
    vocab = tokenizer.get_vocab()
    print(f"Vocab size: {len(vocab)}")
    
    # Sort by index to ensure correct line numbers
    sorted_vocab = sorted(vocab.items(), key=lambda x: x[1])
    
    with open(output_path, 'w', encoding='utf-8') as f:
        for token, index in sorted_vocab:
            f.write(token + '\n')
    
    print("Done!")

if __name__ == "__main__":
    export_vocab()
