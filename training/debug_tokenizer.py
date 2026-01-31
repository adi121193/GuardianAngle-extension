
from transformers import AutoTokenizer
import json

MODEL_DIR = "./results"

def debug_tokenizer():
    print(f"Loading tokenizer from {MODEL_DIR}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    
    # Text from user report (messy)
    text = "Email: aarav.mehta93@gmail.comAddress: 12 Main St"
    
    print(f"\nAnalyzing text: '{text}'")
    
    # Tokenize
    tokens = tokenizer.tokenize(text)
    input_ids = tokenizer.convert_tokens_to_ids(tokens)
    
    print("\nTokens:")
    for i, (token, id) in enumerate(zip(tokens, input_ids)):
        print(f"{i}: {token} ({id})")
        
    print("\nDecoding just to check:")
    decoded = tokenizer.decode(input_ids)
    print(decoded)

if __name__ == "__main__":
    debug_tokenizer()
