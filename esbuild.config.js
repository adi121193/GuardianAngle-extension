import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * esbuild Configuration for PII Guardian Extension
 *
 * This bundler converts ES6 modules into browser-compatible IIFE bundles
 * for Chrome extension compatibility (Manifest V3).
 *
 * Entry Points:
 * - Content Scripts: monitorInputs.js (bundles all dependencies)
 * - UI Scripts: popup.js, settings.js, dashboard.js, license.js
 * - Background: serviceWorker.js
 *
 * Output: dist/ folder (load this in Chrome, not the root folder)
 */

const buildOptions = {
  entryPoints: {
    // Content scripts - monitorInputs imports the other two
    'content/monitorInputs': 'src/content/monitorInputs.js',

    // UI scripts
    'ui/popup': 'src/ui/popup.js',
    'ui/settings': 'src/ui/settings.js',
    'ui/dashboard': 'src/ui/dashboard.js',
    'ui/license': 'src/ui/license.js',

    // Background script
    'background/serviceWorker': 'src/background/serviceWorker.js'
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife', // Immediately Invoked Function Expression - browser compatible
  platform: 'browser',
  target: ['chrome88'], // Chrome 88+ for Manifest V3
  sourcemap: true, // Enable for debugging
  minify: false, // Set to true for production
  define: {
    'process.env.NODE_ENV': '"production"'
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

    // 5. Copy models (if they exist)
    if (existsSync('src/models')) {
      console.log('  → src/models/');
      copyDirectory('src/models', 'dist/models');
    }

    console.log('\n✅ Build complete!\n');
    console.log('📂 Output directory: dist/');
    console.log('🔧 To load in Chrome:');
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
