#!/usr/bin/env node

/**
 * Favicon Generation Script
 *
 * This script helps generate different favicon formats from the SVG source.
 * Run this after updating favicon.svg to generate all required formats.
 */

console.log('🎨 AI Image Agent - Favicon Generator');
console.log('=====================================');
console.log('');
console.log('To generate all favicon formats from your SVG:');
console.log('');
console.log('1. Option 1 - Online converter:');
console.log('   • Go to https://favicon.io/favicon-converter/');
console.log('   • Upload your /public/favicon.svg file');
console.log('   • Download the generated files');
console.log('   • Replace favicon.ico in the public folder');
console.log('');
console.log('2. Option 2 - Using ImageMagick (if installed):');
console.log(
  '   • Run: convert public/favicon.svg -resize 32x32 public/favicon.ico'
);
console.log('');
console.log('3. Option 3 - Using npm package:');
console.log('   • npm install -g favicon-generator-cli');
console.log('   • favicon-generator public/favicon.svg');
console.log('');
console.log('Current favicon setup:');
console.log('✅ favicon.svg - Modern browsers (created)');
console.log('⚠️  favicon.ico - Legacy browsers (update recommended)');
console.log('');
console.log('Your new favicon features:');
console.log('• Teal background (#00BE9B) - Your brand primary color');
console.log('• White Bot icon - Matches your app design');
console.log('• Golden accent dot (#FFB500) - Brand secondary color');
console.log('');
