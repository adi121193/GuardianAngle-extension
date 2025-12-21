/**
 * Text Normalization Utilities for ContentEditable Quirks
 * Handles NBSP, zero-width chars, and other browser-added characters
 */

/**
 * Normalize text for consistent processing
 * Converts non-breaking spaces, zero-width chars, and other invisible characters
 * @param {string} text - Raw text from contenteditable
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
  if (!text) return '';

  return text
    // Non-breaking space to regular space
    .replace(/\u00A0/g, ' ')
    // Zero-width space
    .replace(/\u200B/g, '')
    // Zero-width non-joiner
    .replace(/\u200C/g, '')
    // Zero-width joiner
    .replace(/\u200D/g, '')
    // Soft hyphen
    .replace(/\u00AD/g, '')
    // Left-to-right mark
    .replace(/\u200E/g, '')
    // Right-to-left mark
    .replace(/\u200F/g, '')
    // Word joiner
    .replace(/\u2060/g, '')
    // Narrow no-break space
    .replace(/\u202F/g, ' ')
    // Byte order mark
    .replace(/\uFEFF/g, '');
}

/**
 * Find nth occurrence of a value in text
 * Used for position-independent matching when positions drift
 * @param {string} text - Text to search
 * @param {string} value - Value to find
 * @param {number} occurrence - Which occurrence (0-indexed)
 * @returns {{start: number, end: number}|null} Position or null if not found
 */
export function findNthOccurrence(text, value, occurrence = 0) {
  if (!text || !value) return null;

  let count = 0;
  let index = text.indexOf(value);

  while (index !== -1) {
    if (count === occurrence) {
      return {
        start: index,
        end: index + value.length
      };
    }
    count++;
    index = text.indexOf(value, index + 1);
  }

  return null;
}

/**
 * Find which occurrence number a value is at a given position
 * Used to determine "this is the 3rd occurrence" for later re-finding
 * @param {string} text - Text to search
 * @param {string} value - Value to find
 * @param {number} targetPosition - Position where we found it
 * @returns {number} Occurrence index (0-indexed), or -1 if not found
 */
export function getOccurrenceIndex(text, value, targetPosition) {
  if (!text || !value || targetPosition < 0) return -1;

  let count = 0;
  let index = text.indexOf(value);

  while (index !== -1) {
    if (index === targetPosition) {
      return count;
    }
    count++;
    index = text.indexOf(value, index + 1);
  }

  return -1;
}

/**
 * Find closest occurrence to expected position
 * Used when exact position doesn't match but we want to find nearby match
 * @param {string} text - Text to search
 * @param {string} value - Value to find
 * @param {number} expectedPosition - Where we expected to find it
 * @param {number} maxDistance - Maximum distance to search (default 100 chars)
 * @returns {{start: number, end: number, distance: number}|null} Position and distance, or null
 */
export function findClosestOccurrence(text, value, expectedPosition, maxDistance = 100) {
  if (!text || !value || expectedPosition < 0) return null;

  let closestMatch = null;
  let minDistance = Infinity;

  let index = text.indexOf(value);

  while (index !== -1) {
    const distance = Math.abs(index - expectedPosition);

    if (distance <= maxDistance && distance < minDistance) {
      minDistance = distance;
      closestMatch = {
        start: index,
        end: index + value.length,
        distance: distance
      };
    }

    index = text.indexOf(value, index + 1);
  }

  return closestMatch;
}

/**
 * Compare two texts and find position mapping
 * Useful when text has been slightly modified (e.g., NBSP added)
 * @param {string} originalText - Original text
 * @param {string} currentText - Current text
 * @param {number} originalPosition - Position in original text
 * @returns {number} Mapped position in current text, or -1 if can't map
 */
export function mapPosition(originalText, currentText, originalPosition) {
  // If texts are identical, position is unchanged
  if (originalText === currentText) {
    return originalPosition;
  }

  // Normalize both texts
  const normOriginal = normalizeText(originalText);
  const normCurrent = normalizeText(currentText);

  // If normalized texts are identical, we can map positions
  if (normOriginal === normCurrent) {
    // Build mapping between original and normalized positions
    let origPos = 0;
    let normPos = 0;

    while (origPos < originalText.length && normPos < normOriginal.length) {
      if (origPos === originalPosition) {
        // Found the position in original, now map to current
        let currPos = 0;
        let normPos2 = 0;

        while (currPos < currentText.length && normPos2 < normCurrent.length) {
          if (normPos2 === normPos) {
            return currPos;
          }

          const currChar = currentText[currPos];
          const normChar = normalizeText(currChar);

          currPos++;
          if (normChar) normPos2++;
        }

        return currPos;
      }

      const origChar = originalText[origPos];
      const normChar = normalizeText(origChar);

      origPos++;
      if (normChar) normPos++;
    }
  }

  return -1;
}

/**
 * Get all occurrences of a value in text with their positions
 * @param {string} text - Text to search
 * @param {string} value - Value to find
 * @returns {Array<{start: number, end: number, occurrence: number}>} All occurrences
 */
export function getAllOccurrences(text, value) {
  if (!text || !value) return [];

  const occurrences = [];
  let index = text.indexOf(value);
  let occurrence = 0;

  while (index !== -1) {
    occurrences.push({
      start: index,
      end: index + value.length,
      occurrence: occurrence
    });
    occurrence++;
    index = text.indexOf(value, index + 1);
  }

  return occurrences;
}

/**
 * Create a position-safe match object
 * Enhances a match with occurrence index and normalized value
 * @param {Object} match - Original match object
 * @param {string} text - Text where match was found
 * @returns {Object} Enhanced match with occurrence tracking
 */
export function enhanceMatch(match, text) {
  const { value, position, start } = match;
  const actualPosition = position ?? start ?? -1;

  if (actualPosition < 0) {
    // No position info, try to find first occurrence
    const firstOccurrence = findNthOccurrence(text, value, 0);
    return {
      ...match,
      occurrence: 0,
      normalizedValue: normalizeText(value),
      start: firstOccurrence?.start ?? -1,
      end: firstOccurrence?.end ?? -1
    };
  }

  // Get occurrence index for this position
  const occurrenceIndex = getOccurrenceIndex(text, value, actualPosition);

  return {
    ...match,
    occurrence: occurrenceIndex,
    normalizedValue: normalizeText(value),
    start: actualPosition,
    end: match.end ?? actualPosition + value.length
  };
}
