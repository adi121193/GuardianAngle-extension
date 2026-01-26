#!/bin/bash

# Directory for the model
MODEL_DIR="models/distilbert-ner"

# Create directory if it doesn't exist
mkdir -p "$MODEL_DIR"

echo "Downloading ONNX model and vocabulary to $MODEL_DIR..."

# URLs for Xenova/bert-base-multilingual-cased (Quantized for web)
# We use a quantized model for smaller size (~40MB vs ~400MB)
MODEL_URL="https://huggingface.co/Xenova/bert-base-multilingual-cased/resolve/main/onnx/model_quantized.onnx"
VOCAB_URL="https://huggingface.co/Xenova/bert-base-multilingual-cased/resolve/main/vocab.txt"

# Download model.onnx
if [ -f "$MODEL_DIR/model.onnx" ]; then
    echo "model.onnx already exists. Skipping..."
else
    echo "Downloading model.onnx..."
    curl -L "$MODEL_URL" -o "$MODEL_DIR/model.onnx"
fi

# Download vocab.txt
if [ -f "$MODEL_DIR/vocab.txt" ]; then
    echo "vocab.txt already exists. Skipping..."
else
    echo "Downloading vocab.txt..."
    curl -L "$VOCAB_URL" -o "$MODEL_DIR/vocab.txt"
fi

echo "Download complete!"
ls -lh "$MODEL_DIR"
