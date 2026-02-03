/**
 * NER Model - BERT-base NER with Transformers.js
 * Uses local ONNX model files already bundled with extension
 */

import { env, AutoTokenizer, AutoModelForTokenClassification } from '@xenova/transformers';

// Configure Transformers.js for Chrome extension environment
env.allowLocalModels = true;
env.allowRemoteModels = false; // Force local-only
env.backends.onnx.wasm.numThreads = 1; // Single-threaded for stability
env.backends.onnx.wasm.simd = false;

// Entity types we care about for PII
const PII_ENTITY_TYPES = new Set(['PER', 'PERSON', 'ORG', 'ORGANIZATION', 'LOC', 'LOCATION']);

/**
 * NER Model class using Transformers.js
 */
export class NERModel {
  constructor() {
    this.tokenizer = null;
    this.model = null;
    this.isReady = false;
  }

  /**
   * Load the NER model from local ONNX files
   */
  async loadModel(modelPath) {
    try {
      console.log('[NERModel] Loading model with Transformers.js from:', modelPath);

      // Get base URL for extension resources
      const modelDir = chrome.runtime.getURL('models/distilbert-ner/');

      console.log('[NERModel] Model directory:', modelDir);

      // Load tokenizer and model from local files
      this.tokenizer = await AutoTokenizer.from_pretrained(modelDir, {
        local_files_only: true
      });

      this.model = await AutoModelForTokenClassification.from_pretrained(modelDir, {
        local_files_only: true
      });

      console.log('[NERModel] Model and tokenizer loaded successfully');
      return true;
    } catch (error) {
      console.error('[NERModel] Failed to load model:', error);
      throw error;
    }
  }

  /**
   * Run inference on text
   */
  async runInference(text) {
    if (!this.model || !this.tokenizer) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const startTime = performance.now();

    try {
      // Tokenize input
      const inputs = await this.tokenizer(text);

      // Run inference
      const inferenceStart = performance.now();
      const outputs = await this.model(inputs);
      const inferenceTime = performance.now() - inferenceStart;

      // Get predictions (logits -> labels)
      const logits = outputs.logits.data;
      const numTokens = inputs.input_ids.data.length;
      const numLabels = 9; // BERT NER has 9 labels (O, B-PER, I-PER, etc.)

      // Find best label for each token
      const predictions = [];
      for (let i = 0; i < numTokens; i++) {
        let maxScore = -Infinity;
        let maxLabel = 0;

        for (let j = 0; j < numLabels; j++) {
          const score = logits[i * numLabels + j];
          if (score > maxScore) {
            maxScore = score;
            maxLabel = j;
          }
        }

        predictions.push({ labelId: maxLabel, score: maxScore });
      }

      // Map label IDs to names
      const LABEL_MAP = {
        0: 'O', 1: 'B-MISC', 2: 'I-MISC',
        3: 'B-PER', 4: 'I-PER',
        5: 'B-ORG', 6: 'I-ORG',
        7: 'B-LOC', 8: 'I-LOC'
      };

      // Extract entities
      const entities = [];
      let currentEntity = null;

      const tokens = this.tokenizer.tokenize(text);

      for (let i = 1; i < tokens.length - 1; i++) { // Skip [CLS] and [SEP]
        const token = tokens[i];
        const pred = predictions[i];
        const label = LABEL_MAP[pred.labelId];
        const [position, entityType] = label.split('-');

        if (position === 'B' && PII_ENTITY_TYPES.has(entityType)) {
          if (currentEntity) {
            entities.push(currentEntity);
          }
          currentEntity = {
            type: entityType,
            tokens: [token],
            score: pred.score,
            start: i - 1,
            end: i
          };
        } else if (position === 'I' && currentEntity && entityType === currentEntity.type) {
          currentEntity.tokens.push(token);
          currentEntity.end = i;
          currentEntity.score = Math.min(currentEntity.score, pred.score);
        } else {
          if (currentEntity) {
            entities.push(currentEntity);
            currentEntity = null;
          }
        }
      }

      if (currentEntity) {
        entities.push(currentEntity);
      }

      // Reconstruct entity text
      entities.forEach(entity => {
        entity.text = entity.tokens
          .map(t => t.replace('##', ''))
          .join('')
          .trim();
      });

      const totalTime = performance.now() - startTime;

      return {
        entities,
        performanceMs: {
          total: totalTime,
          inference: inferenceTime
        }
      };
    } catch (error) {
      console.error('[NERModel] Inference failed:', error);
      throw error;
    }
  }

  /**
   * Load vocabulary (API compatibility - handled by tokenizer)
   */
  async loadVocab(vocabPath) {
    console.log('[NERModel] Vocabulary loading handled by Transformers.js tokenizer');
    return true;
  }

  /**
   * Mark model as ready
   */
  setReady() {
    this.isReady = true;
  }

  /**
   * Dispose of model resources
   */
  async dispose() {
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    if (this.tokenizer) {
      this.tokenizer = null;
    }
    this.isReady = false;
  }
}
