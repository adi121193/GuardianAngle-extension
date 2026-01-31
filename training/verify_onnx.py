
import onnxruntime as ort
import numpy as np
from transformers import AutoTokenizer
import os

# Config
MODEL_PATH = "models/distilbert-ner/model.onnx"
VOCAB_PATH = "models/distilbert-ner" # Tokenizer dir

def softmax(x):
    e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return e_x / e_x.sum(axis=-1, keepdims=True)

def verify():
    if not os.path.exists(MODEL_PATH):
        print(f"Model not found at {MODEL_PATH}. Run export first.")
        return

    print(f"Loading tokenizer from {VOCAB_PATH}...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(VOCAB_PATH)
    except:
        # Fallback to local results if model dir is just ONNX
        tokenizer = AutoTokenizer.from_pretrained("./results")

    print(f"Loading ONNX model from {MODEL_PATH}...")
    session = ort.InferenceSession(MODEL_PATH)

    # Test cases (Messy ones)
    test_sentences = [
        "Email:aarav@example.com", 
        "Name:John Doe",
        "Call me at 555-0199now",
        "v"
    ]
    
    label_map = {0: 'O', 1: 'B-EMAIL', 2: 'I-EMAIL', 3: 'B-PHONE', 4: 'I-PHONE', 5: 'B-PER', 6: 'I-PER', 7: 'B-LOC', 8: 'I-LOC'}

    for text in test_sentences:
        print(f"\n--- Testing: '{text}' ---")
        inputs = tokenizer(text, return_tensors="np")
        
        # Prepare ONNX inputs
        onnx_inputs = {
            "input_ids": inputs["input_ids"].astype(np.int64),
            "attention_mask": inputs["attention_mask"].astype(np.int64)
        }
        
        # DistilBERT ONNX might not need token_type_ids, but let's check input names
        input_names = [i.name for i in session.get_inputs()]
        if "token_type_ids" in input_names:
            onnx_inputs["token_type_ids"] = np.zeros_like(inputs["input_ids"]).astype(np.int64)

        # Run inference
        outputs = session.run(None, onnx_inputs)
        logits = outputs[0]
        
        # Decode
        probs = softmax(logits)
        preds = np.argmax(logits, axis=-1)[0]
        tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
        
        # Print Result
        current_entity = None
        for i, (token, pred) in enumerate(zip(tokens, preds)):
            label = label_map.get(pred, "O")
            confidence = np.max(probs[0][i])
            
            if label != "O":
                print(f"  {token:<12} {label:<10} ({confidence:.2f})")

if __name__ == "__main__":
    verify()
