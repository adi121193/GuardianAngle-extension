/**
 * WASM Capabilities Detection
 * Detects browser support for WASM features like SIMD and multi-threading
 */

/**
 * Test if WebAssembly SIMD is supported
 * Uses a minimal SIMD instruction to validate support
 * @returns {boolean}
 */
function detectSIMDSupport() {
  try {
    // Minimal WASM module that uses SIMD (v128 type)
    // This is the i32x4.splat instruction
    const simdTest = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // WASM magic number
      0x01, 0x00, 0x00, 0x00, // WASM version
      0x01, 0x05, 0x01, 0x60, // Type section
      0x00, 0x01, 0x7b,       // Function type: () -> v128
      0x03, 0x02, 0x01, 0x00, // Function section
      0x0a, 0x0a, 0x01, 0x08, // Code section
      0x00, 0x41, 0x00,       // i32.const 0
      0xfd, 0x0f,             // i32x4.splat
      0x0b                    // end
    ]);

    return WebAssembly.validate(simdTest);
  } catch (e) {
    console.warn('[WASMCapabilities] SIMD detection failed:', e);
    return false;
  }
}

/**
 * Test if SharedArrayBuffer is available (required for multi-threading)
 * @returns {boolean}
 */
function detectSharedArrayBufferSupport() {
  try {
    // SharedArrayBuffer is required for WASM threads
    // It may be disabled due to Spectre mitigations unless proper headers are set
    if (typeof SharedArrayBuffer === 'undefined') {
      return false;
    }

    // Try to actually create one
    new SharedArrayBuffer(1);
    return true;
  } catch (e) {
    console.warn('[WASMCapabilities] SharedArrayBuffer not available:', e);
    return false;
  }
}

/**
 * Get the number of logical CPU cores
 * @returns {number}
 */
function getHardwareConcurrency() {
  try {
    return navigator.hardwareConcurrency || 1;
  } catch (e) {
    return 1;
  }
}

/**
 * Check if running in a Chrome extension context
 * Extensions have additional restrictions
 * @returns {boolean}
 */
function isExtensionContext() {
  try {
    return typeof chrome !== 'undefined' &&
           chrome.runtime &&
           chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

/**
 * Detect all WASM capabilities and return optimal configuration
 * @returns {Object} Configuration object for ONNX Runtime
 */
export function detectWASMCapabilities() {
  const capabilities = {
    simd: false,
    threads: 1,
    sharedArrayBuffer: false,
    hardwareConcurrency: 1,
    isExtension: false,
    detectionMethod: 'safe-fallback'
  };

  try {
    // Detect hardware concurrency
    capabilities.hardwareConcurrency = getHardwareConcurrency();

    // Detect extension context
    capabilities.isExtension = isExtensionContext();

    // Detect SharedArrayBuffer support (required for threading)
    capabilities.sharedArrayBuffer = detectSharedArrayBufferSupport();

    // Detect SIMD support
    capabilities.simd = detectSIMDSupport();

    // Determine optimal thread count
    if (capabilities.sharedArrayBuffer && !capabilities.isExtension) {
      // Full threading support (non-extension context)
      capabilities.threads = Math.min(capabilities.hardwareConcurrency, 4);
      capabilities.detectionMethod = 'full-detection';
    } else if (capabilities.sharedArrayBuffer) {
      // Extension context with SharedArrayBuffer - use limited threading
      // Extensions can be tricky, so we limit to 2 threads max
      capabilities.threads = Math.min(capabilities.hardwareConcurrency, 2);
      capabilities.detectionMethod = 'extension-limited';
    } else {
      // No SharedArrayBuffer - single threaded only
      capabilities.threads = 1;
      capabilities.detectionMethod = 'single-thread-fallback';
    }

    console.log('[WASMCapabilities] Detected capabilities:', {
      simd: capabilities.simd,
      threads: capabilities.threads,
      sharedArrayBuffer: capabilities.sharedArrayBuffer,
      hardwareConcurrency: capabilities.hardwareConcurrency,
      isExtension: capabilities.isExtension,
      detectionMethod: capabilities.detectionMethod
    });

  } catch (e) {
    console.error('[WASMCapabilities] Detection failed, using safe defaults:', e);
    capabilities.detectionMethod = 'error-fallback';
  }

  return capabilities;
}

/**
 * Get ONNX Runtime configuration based on detected capabilities
 * @returns {Object} ONNX Runtime env.wasm configuration
 */
export function getORTConfig() {
  const capabilities = detectWASMCapabilities();

  const config = {
    proxy: false,  // Always false for extensions (avoids JSEP issues)
    numThreads: capabilities.threads,
    simd: capabilities.simd,
    // Additional safety settings
    initTimeout: 30000,  // 30 second timeout for initialization
  };

  console.log('[WASMCapabilities] ONNX Runtime config:', config);

  return {
    config,
    capabilities
  };
}

export default {
  detectWASMCapabilities,
  getORTConfig,
  detectSIMDSupport,
  detectSharedArrayBufferSupport
};
