// Node.js script to generate YouRead logo icons
// Run with: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Simple base64 encoded 1x1 PNG as fallback
// In production, you'd use a proper image library like sharp or canvas

console.log('Icon generation script');
console.log('Please use the HTML generators:');
console.log('1. extension/icons/generate-logo-icons.html - for extension icons');
console.log('2. public/logo-generator.html - for website favicon');
console.log('\nOr use an online tool to convert SVG to PNG.');

