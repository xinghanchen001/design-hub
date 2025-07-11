// Test script to check Replicate API response
// Run this in browser console or Node.js

async function testReplicateAPI() {
  const replicateApiKey = 'YOUR_REPLICATE_API_KEY'; // Replace with actual key
  
  console.log('🧪 Testing Replicate API call...');
  
  try {
    const response = await fetch(
      'https://api.replicate.com/v1/models/flux-kontext-apps/multi-image-kontext-max/predictions',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${replicateApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt: "doctor in image 1 meet the patient in image 2",
            input_image_1: "https://example.com/image1.jpg", // Replace with actual image URLs
            input_image_2: "https://example.com/image2.jpg",
            aspect_ratio: "1:1",
            output_format: "png",
            safety_tolerance: 1,
          },
        }),
      }
    );

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.json();
    console.log('📊 Response body:', result);
    
    if (!response.ok) {
      console.error('❌ API call failed:', result);
    } else {
      console.log('✅ API call succeeded:', result);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

// To use this script:
// 1. Replace YOUR_REPLICATE_API_KEY with actual API key
// 2. Replace image URLs with actual bucket image URLs
// 3. Run testReplicateAPI() in console

console.log('Test script loaded. Run testReplicateAPI() with proper API key and image URLs.'); 