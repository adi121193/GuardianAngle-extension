#!/bin/bash

# Directory for the OCR models
MODEL_DIR="models/ocr"

# Create directory if it doesn't exist
mkdir -p "$MODEL_DIR"

echo "Downloading Tesseract language data (eng) to $MODEL_DIR..."

# URL for Tesseract.js compatible fast English data
# Using naptha/tessdata gh-pages branch which is standard for tesseract.js
LANG_URL="https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast/eng.traineddata.gz"

if [ -f "$MODEL_DIR/eng.traineddata.gz" ]; then
    echo "eng.traineddata.gz already exists. Skipping..."
else
    echo "Downloading eng.traineddata.gz..."
    curl -L "$LANG_URL" -o "$MODEL_DIR/eng.traineddata.gz"
fi

echo "Download complete!"
ls -lh "$MODEL_DIR"
