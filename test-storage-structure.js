// Test script for storage utility functions
// Run with: node test-storage-structure.js

import {
  generateStoragePath,
  generateUserImagePath,
  parseStoragePath,
  getBucketName,
  migrateLegacyPath,
} from './supabase/functions/_shared/storage-utils.ts';

console.log('🧪 Testing Storage Utility Functions\n');

// Test 1: Generate storage paths for different projects
console.log('1️⃣ Testing generateStoragePath()');
const project1Path = generateStoragePath({
  userId: 'user123',
  projectId: 'proj456',
  projectType: 'project1',
  timestamp: 1234567890,
});
console.log('Project 1 path:', project1Path);
// Expected: user123/project1/proj456/generated_1234567890.png

const project2Path = generateStoragePath({
  userId: 'user123',
  projectId: 'proj456',
  projectType: 'project2',
  timestamp: 1234567890,
});
console.log('Project 2 path:', project2Path);
// Expected: user123/project2/proj456/print_on_shirt_1234567890.png

const project3Path = generateStoragePath({
  userId: 'user123',
  projectId: 'proj456',
  projectType: 'project3',
  timestamp: 1234567890,
});
console.log('Project 3 path:', project3Path);
// Expected: user123/project3/proj456/journal_1234567890.png

console.log();

// Test 2: Generate user image paths
console.log('2️⃣ Testing generateUserImagePath()');
const referencePath = generateUserImagePath({
  userId: 'user123',
  projectId: 'proj456',
  imageType: 'reference',
  timestamp: 1234567890,
  fileExtension: 'jpg',
});
console.log('Reference image path:', referencePath);
// Expected: user123/reference/proj456/reference_1234567890.jpg

const inputPath = generateUserImagePath({
  userId: 'user123',
  projectId: 'proj456',
  imageType: 'input',
  imageNumber: 2,
  timestamp: 1234567890,
  fileExtension: 'png',
});
console.log('Input image path:', inputPath);
// Expected: user123/inputs/proj456/input_2_1234567890.png

console.log();

// Test 3: Parse storage paths
console.log('3️⃣ Testing parseStoragePath()');
const parsed1 = parseStoragePath(project1Path);
console.log('Parsed Project 1:', parsed1);
// Expected: { userId: 'user123', projectType: 'project1', projectId: 'proj456', filename: 'generated_1234567890.png' }

const legacyPath = 'user123/1234567890_print_on_shirt.png';
const parsedLegacy = parseStoragePath(legacyPath);
console.log('Parsed legacy path:', parsedLegacy);
// Expected: { userId: 'user123', filename: '1234567890_print_on_shirt.png' }

console.log();

// Test 4: Get bucket names
console.log('4️⃣ Testing getBucketName()');
console.log('Generated images bucket:', getBucketName('generated'));
// Expected: ai-generated-images
console.log('User input images bucket:', getBucketName('user-input'));
// Expected: user-images

console.log();

// Test 5: Migrate legacy paths
console.log('5️⃣ Testing migrateLegacyPath()');
const migratedPath = migrateLegacyPath(legacyPath, 'proj456', 'project2');
console.log('Migrated legacy path:', migratedPath);
// Expected: user123/project2/proj456/print_on_shirt_[timestamp].png

console.log();

console.log(
  '✅ All tests completed! Check the outputs above to verify correctness.'
);
console.log();
console.log('📁 Expected Storage Structure:');
console.log('📦 ai-generated-images/');
console.log('  └── user_id/');
console.log('      ├── project1/');
console.log('      │   └── project_id/');
console.log('      │       └── generated_timestamp.png');
console.log('      ├── project2/');
console.log('      │   └── project_id/');
console.log('      │       └── print_on_shirt_timestamp.png');
console.log('      └── project3/');
console.log('          └── project_id/');
console.log('              └── journal_timestamp.png');
console.log();
console.log('📦 user-images/');
console.log('  └── user_id/');
console.log('      ├── reference/');
console.log('      │   └── project_id/');
console.log('      │       └── reference_timestamp.ext');
console.log('      └── inputs/');
console.log('          └── project_id/');
console.log('              └── input_N_timestamp.ext');
