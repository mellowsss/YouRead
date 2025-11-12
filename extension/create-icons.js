// Simple script to create extension icons
// Run with: node create-icons.js

const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
function createSVGIcon(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0ea5e9"/>
  <rect x="${size/8}" y="${size/8}" width="${size*3/4}" height="${size*3/4}" fill="white" stroke="#0284c7" stroke-width="${Math.max(1, size/32)}"/>
  <line x1="${size/6}" y1="${size/3}" x2="${size*5/6}" y2="${size/3}" stroke="#0ea5e9" stroke-width="${Math.max(1, size/64)}"/>
  <line x1="${size/6}" y1="${size/2}" x2="${size*5/6}" y2="${size/2}" stroke="#0ea5e9" stroke-width="${Math.max(1, size/64)}"/>
  <line x1="${size/6}" y1="${size*2/3}" x2="${size*5/6}" y2="${size*2/3}" stroke="#0ea5e9" stroke-width="${Math.max(1, size/64)}"/>
</svg>`;
}

// Note: This creates SVG files. For Chrome extensions, you need PNG.
// You can convert SVG to PNG using an online tool or ImageMagick:
// convert icon16.svg icon16.png

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

sizes.forEach(size => {
  const svg = createSVGIcon(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.svg`), svg);
  console.log(`Created icon${size}.svg`);
});

console.log('\nNote: Chrome extensions need PNG files, not SVG.');
console.log('Please convert the SVG files to PNG using:');
console.log('1. Online converter: https://convertio.co/svg-png/');
console.log('2. Or ImageMagick: convert icon16.svg icon16.png');
console.log('3. Or use the create-icons.html file in the icons folder');

