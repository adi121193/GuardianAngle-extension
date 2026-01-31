# Phase 1 Requirements - Confirmed

**Date:** 2025-11-17
**Status:** ✅ APPROVED

---

## Model Selection

**Decision:** `distilbert-base-uncased-finetuned-ner`

**Rationale:**
- **Size:** 67M parameters (smaller than BERT-base 110M)
- **Speed:** ~2x faster inference than BERT
- **Accuracy:** F1 ~0.91 on CoNLL-2003 (sufficient for our use case)
- **Community:** Well-maintained, widely used
- **License:** Apache 2.0 (compatible with browser extension)

**Alternative Considered:** `dslim/bert-base-NER`
- **Pros:** More accurate (F1 ~0.95)
- **Cons:** Larger (110M params), slower inference
- **Decision:** Not selected (speed/size more important than 4% accuracy gain)

---

## Performance Targets

### Sequence Length:
- **Max:** 512 tokens
- **Rationale:** Standard BERT limit, covers >95% of AI chat inputs

### Latency:
- **WebGPU:** <20ms per chunk
- **WASM:** <100ms per chunk
- **Total (with chunking):** <200ms for average input (500 words)
- **Rationale:** Grammarly-like responsiveness, no UI freeze

### Storage Budget:
- **Model (quantized):** ~35-40MB (INT8) or ~18-20MB (UINT4)
- **WASM Runtime:** ~10MB
- **Tokenizer:** ~1MB
- **Total Assets:** <60MB
- **Rationale:** Acceptable for modern browsers, smaller than many images

### Memory Budget:
- **Model Loaded:** ~80-100MB
- **During Inference:** ~120-150MB (includes temp tensors)
- **Peak Usage:** <200MB
- **Rationale:** Modern browsers handle 200MB easily for extensions

---

## Accuracy Requirements

### Minimum Performance:
- **F1 Score (post-quantization):** >0.85
- **Precision:** >0.83
- **Recall:** >0.87
- **Rationale:** Balance between false positives and false negatives

### Quantization Tolerance:
- **Acceptable F1 Degradation:** <3% (absolute)
- **Example:** FP32 F1 = 0.91, INT8 F1 must be >0.88
- **Rationale:** Small accuracy loss acceptable for 50% size reduction

### False Positive Rate:
- **Hybrid (regex + NER):** <15%
- **NER alone:** <20%
- **Rationale:** Acceptable UX impact, better than regex-only

### Entity Coverage:
- **Must Detect:**
  - Person names (PER): 90%+ recall
  - Organizations (ORG): 85%+ recall
  - Locations (LOC): 85%+ recall
- **Nice to Have:**
  - Miscellaneous (MISC): 70%+ recall

---

## Quantization Strategy

### Primary: INT8 Quantization
- **Method:** Post-training static quantization
- **Library:** ONNX Runtime Quantization (optimum-cli)
- **Settings:**
  - Weight type: `qint8`
  - Activation type: `quint8`
  - Per-channel quantization: `enabled`
  - Operators: MatMul, Add, Mul

**Expected Results:**
- Size: ~35-40MB (vs ~67MB FP32)
- Speed: ~1.3x faster inference (INT8 ops)
- Accuracy: 1-2% F1 degradation

### Alternative: UINT4 Quantization (Experimental)
- **Method:** Ultra-low precision quantization
- **Settings:**
  - Weight type: `uint4`
  - Activation type: `quint8`
  - Symmetric weight quantization

**Expected Results:**
- Size: ~18-20MB (vs ~67MB FP32)
- Speed: ~1.5x faster inference
- Accuracy: 4-6% F1 degradation (may be unacceptable)

**Decision:** Test both, prefer INT8 unless UINT4 meets accuracy threshold

---

## Test Dataset

### Test Cases (Manual):
1. **Person Names:**
   - "My name is Rohan Malhotra"
   - "Contact John Smith"
   - "Dr. Sarah Johnson"

2. **Organizations:**
   - "I work at Google"
   - "Microsoft announced"
   - "The World Health Organization"

3. **Locations:**
   - "I live in Mumbai"
   - "Meeting in New York City"
   - "Traveling to San Francisco"

4. **Mixed Entities:**
   - "Rohan Malhotra from Mumbai works at Google"
   - "John Smith, CEO of Microsoft, lives in Seattle"

5. **Challenging Cases:**
   - "Apple announced" (ORG vs common word)
   - "Bush visited" (PER vs common word)
   - "I met Jordan" (PER vs location)

### Ground Truth:
```json
[
  {
    "text": "My name is Rohan Malhotra and I live in Mumbai. My email is rohan@example.com",
    "entities": [
      {"type": "PER", "value": "Rohan Malhotra", "start": 11, "end": 25},
      {"type": "LOC", "value": "Mumbai", "start": 41, "end": 47}
    ]
  },
  {
    "text": "John Smith works at Google in New York City",
    "entities": [
      {"type": "PER", "value": "John Smith", "start": 0, "end": 10},
      {"type": "ORG", "value": "Google", "start": 20, "end": 26},
      {"type": "LOC", "value": "New York City", "start": 30, "end": 43}
    ]
  }
]
```

### Success Criteria:
- All person names detected: ✅
- All organizations detected: ✅
- All locations detected: ✅
- No false positives on common words: ✅
- F1 score >0.85: ✅

---

## Deliverables Checklist

- [ ] Model exported to ONNX (FP32)
- [ ] Model quantized to INT8
- [ ] Model quantized to UINT4 (optional comparison)
- [ ] Validation script created
- [ ] Accuracy validated (>0.85 F1)
- [ ] Tokenizer files extracted
- [ ] Label mapping documented
- [ ] Model assets organized in `models/distilbert-ner/`
- [ ] Licensing documented
- [ ] README created
- [ ] .gitignore updated

---

## Gate Criteria

**Phase 1 can be considered COMPLETE when:**

✅ **Model Quality:**
- INT8 model F1 score >0.85 on test cases
- Quantization degradation <3% absolute

✅ **Asset Completeness:**
- All required files present and valid:
  - model.onnx
  - tokenizer.json
  - vocab.txt
  - config.json
  - special_tokens_map.json
  - label_map.json

✅ **Size Requirements:**
- Model size <40MB (INT8) or <20MB (UINT4)
- All assets <50MB combined

✅ **Documentation:**
- LICENSE.txt present
- README.md complete
- Validation results documented

✅ **Build Integration:**
- Model directory added to project
- .gitignore updated
- No errors when building extension

**If ALL criteria met → Proceed to Phase 2**
**If ANY criteria NOT met → Fix before proceeding**

---

## Approved By

**Developer:** Claude Code Assistant
**Date:** 2025-11-17
**Status:** ✅ READY TO IMPLEMENT
