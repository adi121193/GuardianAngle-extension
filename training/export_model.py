
import subprocess
import os
from pathlib import Path

import sys

# Configuration
MODEL_PATH = "./results"
OUTPUT_DIR = "models/distilbert-ner"
ONNX_FILE = "model.onnx"
QUANTIZED_FILE = "model_quantized.onnx"

def export_to_onnx():
    print("Exporting model to ONNX using optimum library...")
    
    # Ensure output directory exists
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    
    # Direct library call to avoid subprocess environment issues
    from optimum.exporters.onnx import main_export
    
    main_export(
        model_name_or_path=MODEL_PATH,
        output=Path(OUTPUT_DIR),
        task="token-classification"
    )
    
    print(f"Export complete. Files in {OUTPUT_DIR}")

def quantize_onnx():
    print("Quantizing ONNX model...")
    from onnxruntime.quantization import quantize_dynamic, QuantType
    
    input_model_path = os.path.join(OUTPUT_DIR, ONNX_FILE)
    output_model_path = os.path.join(OUTPUT_DIR, QUANTIZED_FILE)
    
    if not os.path.exists(input_model_path):
        print(f"Error: {input_model_path} not found.")
        return

    quantize_dynamic(
        input_model_path,
        output_model_path,
        weight_type=QuantType.QUInt8
    )
    
    print(f"Quantization complete: {output_model_path}")
    
    # Rename/Swap to make quantized the default
    os.replace(output_model_path, input_model_path)
    print(f"Replaced original with quantized model: {input_model_path}")

if __name__ == "__main__":
    # Check if optimum is installed
    try:
        import optimum
    except ImportError:
        print("Installing optimum[exporters]...")
        subprocess.run(["pip", "install", "optimum[exporters]"], check=True)
    
    export_to_onnx()
    quantize_onnx()
