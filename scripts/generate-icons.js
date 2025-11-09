#!/usr/bin/env node

/**
 * PII Guardian Icon Generator
 * Generates PNG icons in sizes 16x16, 32x32, 48x48, and 128x128
 * Uses Node.js Canvas API (requires canvas package)
 *
 * Usage: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Try to use canvas package if available, otherwise provide instructions
let Canvas;
try {
  Canvas = require('canvas');
} catch (error) {
  console.error('❌ Canvas package not found!');
  console.error('\nPlease install canvas package:');
  console.error('  npm install canvas --save-dev\n');
  console.error('OR use the HTML generator instead:');
  console.error('  1. Open scripts/generate-icons.html in your browser');
  console.error('  2. Click "Generate & Download All Icons"');
  console.error('  3. Move downloaded files to assets/icons/\n');
  process.exit(1);
}

const { createCanvas } = Canvas;

/**
 * Draw a shield icon with checkmark on the canvas
 * @param {Canvas} canvas - The canvas to draw on
 * @param {number} size - The size of the icon (width/height)
 */
function drawShieldIcon(canvas, size) {
  const ctx = canvas.getContext('2d');

  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Scale factor for consistent proportions
  const scale = size / 128;
  ctx.save();
  ctx.scale(scale, scale);

  // Draw shield outline
  ctx.beginPath();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Shield shape
  ctx.moveTo(64, 20);
  ctx.lineTo(100, 35);
  ctx.lineTo(100, 70);
  ctx.quadraticCurveTo(100, 90, 64, 108);
  ctx.quadraticCurveTo(28, 90, 28, 70);
  ctx.lineTo(28, 35);
  ctx.closePath();
  ctx.stroke();

  // Draw checkmark inside shield
  ctx.beginPath();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(45, 64);
  ctx.lineTo(58, 77);
  ctx.lineTo(83, 52);
  ctx.stroke();

  ctx.restore();
}

/**
 * Generate and save an icon PNG file
 * @param {number} size - The size of the icon (width/height)
 * @param {string} outputPath - The path to save the PNG file
 */
function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  drawShieldIcon(canvas, size);

  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Generated: ${path.basename(outputPath)} (${size}x${size})`);
}

/**
 * Main function to generate all icons
 */
function main() {
  console.log('🛡️  PII Guardian - Icon Generator\n');

  // Define output directory
  const iconsDir = path.join(__dirname, '..', 'assets', 'icons');

  // Create directory if it doesn't exist
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
    console.log(`📁 Created directory: ${iconsDir}\n`);
  }

  // Icon sizes required by Chrome extensions
  const sizes = [16, 32, 48, 128];

  // Generate each icon
  sizes.forEach(size => {
    const outputPath = path.join(iconsDir, `icon${size}.png`);
    generateIcon(size, outputPath);
  });

  console.log('\n✨ All icons generated successfully!');
  console.log(`📍 Location: ${iconsDir}`);
  console.log('\n🔄 Next steps:');
  console.log('  1. Reload the extension in Chrome (chrome://extensions)');
  console.log('  2. The new icons should now appear');
  console.log('  3. Test the extension functionality\n');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { generateIcon, drawShieldIcon };
