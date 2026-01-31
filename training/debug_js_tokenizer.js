
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock vocab
const vocab = new Map();

// Helper to load vocab
function loadVocab() {
    const vocabPath = path.join(__dirname, '../models/distilbert-ner/vocab.txt');
    const text = fs.readFileSync(vocabPath, 'utf-8');
    const tokens = text.split('\n').filter(line => line.trim());
    tokens.forEach((token, idx) => {
        vocab.set(token, idx);
    });
    console.log(`Loaded ${vocab.size} tokens`);
}

// Tokenizer Logic (Modified/Fixed)
function tokenize(text) {
    const tokens = ['[CLS]'];

    // Normalize whitespace only (DO NOT lowercase - this is a CASED model!)
    const normalized = text.trim().replace(/\s+/g, ' ');

    // Split on whitespace and punctuation while preserving punctuation
    const rawWords = normalized.split(/(\s+|[.,!?;:()\[\]{}'"<>\/\\@#$%^&*+=|~`-])/g)
        .filter(w => w.trim().length > 0);

    for (const originalWord of rawWords) {
        // Skip pure whitespace
        if (/^\s+$/.test(originalWord)) continue;

        let word = originalWord;

        // Try full word as-is first (preserving case)
        if (vocab.has(word)) {
            tokens.push(word);
            continue;
        }

        // REMOVED: Aggressive lowercase fallback for full word
        // const lowerWord = word.toLowerCase();
        // if (vocab.has(lowerWord)) ...

        const lowerWord = word.toLowerCase(); // Kept for reference but not for direct match

        // Word-piece tokenization - try cased first, then uncased
        let start = 0;
        while (start < word.length) {
            let end = word.length;
            let found = false;

            while (start < end) {
                // Try original case
                const substrCased = start === 0 ? word.substring(start, end) : '##' + word.substring(start, end);
                if (vocab.has(substrCased)) {
                    tokens.push(substrCased);
                    start = end;
                    found = true;
                    break;
                }

                // REMOVED: Aggressive lowercase fallback for subwords
                /*
                const substrLower = start === 0 ? lowerWord.substring(start, end) : '##' + lowerWord.substring(start, end);
                if (vocab.has(substrLower)) {
                  tokens.push(substrLower);
                  start = end;
                  found = true;
                  break;
                }
                */

                end--;
            }

            if (!found) {
                // Fallback logic for Cased models (DistilBERT):
                // If we can't find a cased token, DO WE try lowercase?
                // Python tokenizer output 'Em' and '##ail' suggests 'Email' -> [UNK]? No.
                // Python output was: Em (18653), ##ail (11922).
                // Those ARE cased tokens.
                // So if we don't match, we shouldn't force lowercase unless the model is uncased.
                // Wait, what if the word is "EXample"? "Ex" "##ample"?

                // For now, assume STRICT cased matching is what we want.
                tokens.push('[UNK]');
                start++; // Move forward
            }
        }
    }

    tokens.push('[SEP]');
    return tokens;
}

// Data
const text = "Email: aarav.mehta93@gmail.comAddress: 12 Main St";

// Run
loadVocab();
console.log(`\nAnalyzing text: '${text}'`);
const tokens = tokenize(text);
console.log('\nTokens:');
tokens.forEach((t, i) => console.log(`${i}: ${t} (${vocab.get(t)})`));
