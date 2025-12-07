/**
 * NER Model - BERT-base NER with ONNX Runtime
 * Handles model loading, tokenization, and inference
 */

import * as ort from 'onnxruntime-web';

// Label mapping for BERT-base NER
const LABEL_MAP = {
  0: 'O',      // Outside entity
  1: 'B-PER',  // Begin Person
  2: 'I-PER',  // Inside Person
  3: 'B-ORG',  // Begin Organization
  4: 'I-ORG',  // Inside Organization
  5: 'B-LOC',  // Begin Location
  6: 'I-LOC',  // Inside Location
  7: 'B-MISC', // Begin Miscellaneous
  8: 'I-MISC'  // Inside Miscellaneous
};

// Entity types we care about for PII
const PII_ENTITY_TYPES = new Set(['PER', 'ORG', 'LOC']);

/**
 * NER Model class
 */
export class NERModel {
  constructor() {
    this.session = null;
    this.tokenizer = null;
    this.vocab = null;
    this.isReady = false;
    this.modelPath = null;
  }

  /**
   * Initialize ONNX Runtime with execution providers
   */
  async initializeRuntime() {
    console.log('[NERModel] Initializing ONNX Runtime...');

    // Configure ONNX Runtime
    // Try WebGPU first, fallback to WASM
    ort.env.wasm.numThreads = 4;
    ort.env.wasm.simd = true;
    ort.env.logLevel = 'warning';

    // Set execution providers in order of preference
    const executionProviders = [];

    // Try WebGPU if available
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const adapter = await navigator.gpu?.requestAdapter();
        if (adapter) {
          console.log('[NERModel] WebGPU available, will try as primary EP');
          executionProviders.push('webgpu');
        }
      } catch (e) {
        console.log('[NERModel] WebGPU check failed:', e.message);
      }
    }

    // Always add WASM as fallback
    executionProviders.push('wasm');

    console.log('[NERModel] Execution providers:', executionProviders);
    return executionProviders;
  }

  /**
   * Load the ONNX model
   */
  async loadModel(modelPath) {
    console.log('[NERModel] Loading model from:', modelPath);
    const startTime = performance.now();

    try {
      // Initialize runtime
      const executionProviders = await this.initializeRuntime();

      // Load ONNX session
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders,
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
      });

      const loadTime = performance.now() - startTime;
      console.log(`[NERModel] Model loaded in ${loadTime.toFixed(0)}ms`);
      console.log('[NERModel] Input names:', this.session.inputNames);
      console.log('[NERModel] Output names:', this.session.outputNames);

      this.modelPath = modelPath;
      return true;
    } catch (error) {
      console.error('[NERModel] Failed to load model:', error);
      throw error;
    }
  }

  /**
   * Load vocabulary for tokenization
   */
  async loadVocab(vocabPath) {
    console.log('[NERModel] Loading vocabulary from:', vocabPath);

    try {
      const response = await fetch(vocabPath);
      const text = await response.text();

      // Parse vocab.txt - each line is a token
      const tokens = text.split('\n').filter(line => line.trim());

      // Create token to ID mapping
      this.vocab = new Map();
      tokens.forEach((token, idx) => {
        this.vocab.set(token, idx);
      });

      console.log(`[NERModel] Loaded ${this.vocab.size} vocabulary tokens`);
      return true;
    } catch (error) {
      console.error('[NERModel] Failed to load vocabulary:', error);
      throw error;
    }
  }

  /**
   * BERT-style tokenizer (improved word-piece tokenization)
   * Handles punctuation and special characters better
   */
  tokenize(text) {
    const tokens = ['[CLS]'];

    // Normalize whitespace and lowercase
    const normalized = text.trim().replace(/\s+/g, ' ');

    // Split on whitespace and punctuation while preserving punctuation
    const rawWords = normalized.split(/(\s+|[.,!?;:()\[\]{}'"<>\/\\@#$%^&*+=|~`-])/g)
      .filter(w => w.trim().length > 0);

    for (let word of rawWords) {
      // Skip pure whitespace
      if (/^\s+$/.test(word)) continue;

      // Lowercase for vocabulary lookup
      word = word.toLowerCase();

      // Try full word first
      if (this.vocab.has(word)) {
        tokens.push(word);
      } else {
        // Word-piece tokenization
        let start = 0;
        while (start < word.length) {
          let end = word.length;
          let found = false;

          while (start < end) {
            const substr = start === 0 ? word.substring(start, end) : '##' + word.substring(start, end);
            if (this.vocab.has(substr)) {
              tokens.push(substr);
              start = end;
              found = true;
              break;
            }
            end--;
          }

          if (!found) {
            // Unknown token
            tokens.push('[UNK]');
            start++; // Move forward to avoid infinite loop
          }
        }
      }
    }

    tokens.push('[SEP]');

    // Truncate to max sequence length (512 for BERT)
    if (tokens.length > 512) {
      return tokens.slice(0, 511).concat(['[SEP]']);
    }

    return tokens;
  }

  /**
   * Convert tokens to input IDs
   */
  tokensToIds(tokens) {
    return tokens.map(token => this.vocab.get(token) || this.vocab.get('[UNK]'));
  }

  /**
   * Prepare input tensors for ONNX model
   * Uses int32 for better browser compatibility (BigInt64Array not supported in all browsers)
   */
  prepareInputs(inputIds) {
    const seqLength = inputIds.length;

    // Try to use int64 with BigInt if supported, otherwise fall back to int32
    let dtype = 'int32';
    let createTensor;

    try {
      // Check if BigInt64Array is supported
      if (typeof BigInt64Array !== 'undefined') {
        dtype = 'int64';
        createTensor = (data) => BigInt64Array.from(data.map(v => BigInt(v)));
      } else {
        createTensor = (data) => Int32Array.from(data);
      }
    } catch (e) {
      // Fallback to int32
      console.warn('[NERModel] BigInt not supported, using int32');
      createTensor = (data) => Int32Array.from(data);
    }

    // Input IDs
    const inputIdsTensor = new ort.Tensor(dtype, createTensor(inputIds), [1, seqLength]);

    // Attention mask (1 for real tokens, 0 for padding)
    const attentionMask = new Array(seqLength).fill(1);
    const attentionMaskTensor = new ort.Tensor(dtype, createTensor(attentionMask), [1, seqLength]);

    // Token type IDs (0 for first sequence)
    const tokenTypeIds = new Array(seqLength).fill(0);
    const tokenTypeIdsTensor = new ort.Tensor(dtype, createTensor(tokenTypeIds), [1, seqLength]);

    return {
      input_ids: inputIdsTensor,
      attention_mask: attentionMaskTensor,
      token_type_ids: tokenTypeIdsTensor
    };
  }

  /**
   * Run inference on text
   */
  async runInference(text) {
    if (!this.session || !this.vocab) {
      throw new Error('Model not loaded. Call loadModel() and loadVocab() first.');
    }

    const startTime = performance.now();

    try {
      // Tokenize
      const tokens = this.tokenize(text);
      const inputIds = this.tokensToIds(tokens);

      // Prepare inputs
      const feeds = this.prepareInputs(inputIds);

      // Run inference
      const inferenceStart = performance.now();
      const results = await this.session.run(feeds);
      const inferenceTime = performance.now() - inferenceStart;

      // Get logits (output is typically named 'logits')
      const logitsKey = Object.keys(results)[0];
      const logits = results[logitsKey];

      // Convert logits to predictions
      const predictions = this.logitsToPredictions(logits.data, tokens.length);

      // Aggregate entities
      const entities = this.aggregateEntities(tokens, predictions, text);

      const totalTime = performance.now() - startTime;

      console.log(`[NERModel] Inference completed in ${totalTime.toFixed(0)}ms (inference: ${inferenceTime.toFixed(0)}ms)`);

      return {
        entities,
        tokens,
        predictions,
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
   * Convert logits to predicted labels
   */
  logitsToPredictions(logitsData, seqLength) {
    const predictions = [];
    const numLabels = 9; // 0-8 for BERT-base NER

    for (let i = 0; i < seqLength; i++) {
      const startIdx = i * numLabels;
      let maxScore = -Infinity;
      let maxLabel = 0;

      for (let j = 0; j < numLabels; j++) {
        const score = logitsData[startIdx + j];
        if (score > maxScore) {
          maxScore = score;
          maxLabel = j;
        }
      }

      predictions.push({
        label: LABEL_MAP[maxLabel],
        labelId: maxLabel,
        score: maxScore
      });
    }

    return predictions;
  }

  /**
   * Aggregate consecutive tokens into entities
   */
  aggregateEntities(tokens, predictions, originalText) {
    const entities = [];
    let currentEntity = null;

    for (let i = 1; i < tokens.length - 1; i++) { // Skip [CLS] and [SEP]
      const token = tokens[i];
      const pred = predictions[i];
      const [position, entityType] = pred.label.split('-');

      if (position === 'B' && PII_ENTITY_TYPES.has(entityType)) {
        // Start new entity
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
        // Continue entity
        currentEntity.tokens.push(token);
        currentEntity.end = i;
        currentEntity.score = Math.min(currentEntity.score, pred.score);
      } else {
        // End entity
        if (currentEntity) {
          entities.push(currentEntity);
          currentEntity = null;
        }
      }
    }

    // Add last entity
    if (currentEntity) {
      entities.push(currentEntity);
    }

    // Reconstruct entity text
    entities.forEach(entity => {
      entity.text = entity.tokens
        .map(t => t.replace('##', ''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    });

    return entities;
  }

  /**
   * Mark model as ready
   */
  setReady() {
    this.isReady = true;
    console.log('[NERModel] Model is ready for inference');
  }

  /**
   * Dispose of model resources
   */
  async dispose() {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.vocab = null;
    this.isReady = false;
    console.log('[NERModel] Model resources released');
  }
}
