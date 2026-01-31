#!/bin/bash
# Script to optimize dist/models by removing full model and keeping only quantized

echo "🔧 Optimizing model files for production..."

if [ -d "dist/models/distilbert-ner" ]; then
  # Remove full model files (keep only quantized)
  if [ -f "dist/models/distilbert-ner/model.onnx.data" ]; then
    echo "  → Removing model.onnx.data (249 MB)"
    rm dist/models/distilbert-ner/model.onnx.data
  fi
  
  if [ -f "dist/models/distilbert-ner/model.onnx" ]; then
    echo "  → Removing model.onnx (0.7 MB)"
    rm dist/models/distilbert-ner/model.onnx
  fi
  
  # Verify quantized model exists
  if [ -f "dist/models/distilbert-ner/model_quantized.onnx" ]; then
    echo "  ✅ Keeping model_quantized.onnx (63 MB)"
  else
    echo "  ❌ ERROR: model_quantized.onnx not found!"
    exit 1
  fi
  
  echo "✅ Model optimization complete"
  echo "📦 Final model size: ~63 MB (quantized only)"
else
  echo "⏭️  No models directory found (FREE tier)"
fi
