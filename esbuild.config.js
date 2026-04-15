import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get tier from environment variable (free or pro)
const tier = process.env.EXTENSION_TIER || 'pro';
const isPro = tier === 'pro';

console.log(`\n🎯 Building ${tier.toUpperCase()} tier\n`);

/**
 * esbuild Configuration for Guardian Angle Extension
 *
 * Supports tier-based builds:
 * - FREE: Regex-only detection, no ML models (~5-10 MB)
 * - PRO: Full NER + OCR with ML models (~70-80 MB)
 *
 * Usage:
 * - npm run build:free  (Free tier)
 * - npm run build:pro   (Pro tier)
 *
 * Output: dist/ folder (load this in Chrome, not the root folder)
 */

const buildOptions = {
  entryPoints: {
    // Content scripts
    'content/monitorInputs': 'src/content/monitorInputs.js',
    'content/detectText': 'src/content/detectText.js',

    // UI scripts
    'ui/popup': 'src/ui/popup.js',
    'ui/welcome': 'src/ui/welcome.js',

    // Background script
    'background/serviceWorker': 'src/background/serviceWorker.js',

    // ML scripts (Offscreen)
    'ml/offscreen': 'src/ml/offscreen.js',

    // Debug
    'ui/debugOcr': 'src/ui/debugOcr.js',

    // PRO-only entry points
    ...(isPro ? {
      'ui/history': 'src/ui/history.js',
      'ml/offscreen': 'src/ml/offscreen.js' // Keep here for reference/completeness if needed, but duplicate key is fine or handled by last write
    } : {})
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife', // Immediately Invoked Function Expression - browser compatible
  platform: 'browser',
  target: ['chrome88'], // Chrome 88+ for Manifest V3
  sourcemap: true, // Enable for debugging
  minify: false, // Set to true for production
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.EXTENSION_TIER': `"${tier}"`
  }
};

/**
 * Recursively copy directory contents
 */
function copyDirectory(src, dest) {
  if (!existsSync(src)) {
    console.warn(`⚠️  Source directory not found: ${src}`);
    return;
  }

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Main build function
 */
async function build() {
  try {
    console.log('🚀 Building PII Guardian Extension...\n');

    // Clean dist folder
    if (existsSync('dist')) {
      console.log('🧹 Cleaning dist folder...');
      rmSync('dist', { recursive: true, force: true });
    }

    // Create dist folder
    mkdirSync('dist', { recursive: true });

    // Build JavaScript bundles
    console.log('📦 Bundling JavaScript files...');
    await esbuild.build(buildOptions);
    console.log('✅ JavaScript bundled successfully\n');

    // Copy static files
    console.log('📋 Copying static files...\n');

    // 1. Copy manifest.json
    console.log('  → manifest.json');
    copyFileSync('manifest.json', 'dist/manifest.json');

    // 2. Copy HTML files
    console.log('  → html/');
    copyDirectory('html', 'dist/html');

    // 3. Copy styles
    console.log('  → src/styles/');
    copyDirectory('src/styles', 'dist/styles');

    // 4. Copy assets (icons)
    console.log('  → assets/');
    copyDirectory('assets', 'dist/assets');

    // 5. Copy OCR files ONLY (PRO) - NER removed
    if (isPro) {
      console.log('  → OCR files (PRO)');

      // Copy Tesseract.js files for OCR
      mkdirSync('dist/ocr', { recursive: true });

      // Copy worker
      copyFileSync('node_modules/tesseract.js/dist/worker.min.js', 'dist/ocr/worker.min.js');

      // Copy main library (for script tag loading)
      copyFileSync('node_modules/tesseract.js/dist/tesseract.min.js', 'dist/ocr/tesseract.min.js');

      // Copy core JS
      copyFileSync('node_modules/tesseract.js-core/tesseract-core.wasm.js', 'dist/ocr/tesseract-core.wasm.js');

      // Copy ALL core variants (SIMD, LSTM, etc.) to prevent capability-check 404s
      const coreDir = 'node_modules/tesseract.js-core/';
      const coreFiles = readdirSync(coreDir).filter(f => f.startsWith('tesseract-core'));

      coreFiles.forEach(file => {
        copyFileSync(join(coreDir, file), join('dist/ocr', file));
        console.log(`     ✓ Copied ${file}`);
      });

      // Copy local OCR models (if present) for self-hosted mode
      if (existsSync('src/models/ocr')) {
        console.log('  → Copying local OCR models...');
        mkdirSync('dist/models/ocr', { recursive: true });
        copyDirectory('src/models/ocr', 'dist/models/ocr');
        console.log('     ✓ Local language files copied');
      }

      console.log('     ✓ Tesseract files copied for OCR');
    } else {
      console.log('  ⏭️  Skipping OCR (FREE tier)');
    }

    console.log(`\n✅ ${tier.toUpperCase()} tier build complete!\n`);
    console.log('📂 Output directory: dist/');
    console.log(`🎯 Tier: ${tier.toUpperCase()}`);
    console.log(`📦 Expected size: ${isPro ? '~15-20 MB' : '~5-10 MB'}`);
    console.log(`✨ Features: ${isPro ? 'OCR + Enhanced Regex (25+ patterns)' : 'Regex-only detection'}`);
    console.log('\n🔧 To load in Chrome:');
    console.log('   1. Go to chrome://extensions');
    console.log('   2. Enable "Developer mode"');
    console.log('   3. Click "Load unpacked"');
    console.log('   4. Select the "dist" folder\n');

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();
