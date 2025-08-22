const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';
let authToken = '';

// Create a test image file
const createTestImage = () => {
  const imageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
  const tempPath = path.join(__dirname, 'test-image.png');
  fs.writeFileSync(tempPath, imageBuffer);
  return tempPath;
};

// Login function - using Google auth mock for testing
async function login() {
  try {
    // For testing, we'll use a mock Google token
    // In production, you would get this from Google Sign-In
    const response = await axios.post(`${API_BASE}/auth/google`, {
      idToken: 'mock-google-token-for-testing'
    });
    authToken = response.data.data.token;
    console.log('✓ Logged in successfully');
    return response.data.data;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    console.log('\nNote: This test requires proper Google authentication.');
    console.log('You can obtain a real access token by:');
    console.log('1. Using the Google Sign-In flow in your app');
    console.log('2. Or manually set authToken in this script');
    process.exit(1);
  }
}

// Test profile picture upload
async function testProfilePictureUpload() {
  console.log('\n--- Testing Profile Picture Upload ---');
  
  try {
    const imagePath = createTestImage();
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath), 'profile-pic.png');

    const response = await axios.post(
      `${API_BASE}/users/media/profile-picture`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    console.log('✓ Profile picture uploaded:', response.data.data);
    fs.unlinkSync(imagePath);
    return response.data.data.profilePic.id;
  } catch (error) {
    console.error('Profile picture upload failed:', error.response?.data || error.message);
  }
}

// Test profile picture deletion
async function testProfilePictureDelete() {
  console.log('\n--- Testing Profile Picture Delete ---');
  
  try {
    const response = await axios.delete(
      `${API_BASE}/users/media/profile-picture`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    console.log('✓ Profile picture deleted:', response.data);
  } catch (error) {
    console.error('Profile picture delete failed:', error.response?.data || error.message);
  }
}

// Test banner upload
async function testBannerUpload() {
  console.log('\n--- Testing Banner Upload ---');
  
  try {
    const imagePath = createTestImage();
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath), 'banner.png');

    const response = await axios.post(
      `${API_BASE}/users/media/banner`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    console.log('✓ Banner uploaded:', response.data.data);
    fs.unlinkSync(imagePath);
    return response.data.data.banner.id;
  } catch (error) {
    console.error('Banner upload failed:', error.response?.data || error.message);
  }
}

// Create a test post
async function createTestPost() {
  console.log('\n--- Creating Test Post ---');
  
  try {
    const response = await axios.post(
      `${API_BASE}/posts`,
      {
        title: 'Test Post for Media Upload',
        content: 'This is a test post to demonstrate image uploads',
        type: 'text',
        visibility: 'public'
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    console.log('✓ Post created:', response.data.data.post.id);
    return response.data.data.post.id;
  } catch (error) {
    console.error('Post creation failed:', error.response?.data || error.message);
  }
}

// Test post image upload
async function testPostImageUpload(postId) {
  console.log('\n--- Testing Post Image Upload ---');
  
  try {
    const form = new FormData();
    
    // Add multiple test images
    for (let i = 1; i <= 3; i++) {
      const imagePath = createTestImage();
      form.append('files', fs.createReadStream(imagePath), `post-image-${i}.png`);
    }

    const response = await axios.post(
      `${API_BASE}/posts/${postId}/images`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    console.log('✓ Post images uploaded:', response.data.data);
    
    // Clean up test images
    for (let i = 1; i <= 3; i++) {
      const imagePath = path.join(__dirname, 'test-image.png');
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    return response.data.data.images;
  } catch (error) {
    console.error('Post image upload failed:', error.response?.data || error.message);
  }
}

// Test get post images
async function testGetPostImages(postId) {
  console.log('\n--- Testing Get Post Images ---');
  
  try {
    const response = await axios.get(
      `${API_BASE}/posts/${postId}/images`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    console.log('✓ Post images retrieved:', response.data.data);
    return response.data.data.images;
  } catch (error) {
    console.error('Get post images failed:', error.response?.data || error.message);
  }
}

// Test reorder post images
async function testReorderPostImages(postId, images) {
  console.log('\n--- Testing Reorder Post Images ---');
  
  if (!images || images.length < 2) {
    console.log('⚠ Not enough images to reorder');
    return;
  }

  try {
    const imageOrders = images.map((img, index) => ({
      id: img.id,
      order: images.length - index - 1 // Reverse order
    }));

    const response = await axios.put(
      `${API_BASE}/posts/${postId}/images/reorder`,
      { imageOrders },
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    console.log('✓ Post images reordered:', response.data);
  } catch (error) {
    console.error('Reorder post images failed:', error.response?.data || error.message);
  }
}

// Test delete post image
async function testDeletePostImage(postId, imageId) {
  console.log('\n--- Testing Delete Post Image ---');
  
  if (!imageId) {
    console.log('⚠ No image to delete');
    return;
  }

  try {
    const response = await axios.delete(
      `${API_BASE}/posts/${postId}/images/${imageId}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    console.log('✓ Post image deleted:', response.data);
  } catch (error) {
    console.error('Delete post image failed:', error.response?.data || error.message);
  }
}

// Test media gallery
async function testMediaGallery() {
  console.log('\n--- Testing Media Gallery ---');
  
  try {
    const response = await axios.get(
      `${API_BASE}/media/gallery`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    console.log('✓ Media gallery retrieved:');
    console.log('  Total items:', response.data.data.total);
    console.log('  Items:', response.data.data.items.length);
  } catch (error) {
    console.error('Media gallery failed:', error.response?.data || error.message);
  }
}

// Main test function
async function runTests() {
  console.log('=== Media Upload Tests ===\n');

  // Login
  await login();

  // Test user profile media
  await testProfilePictureUpload();
  await testBannerUpload();
  
  // Test post media
  const postId = await createTestPost();
  if (postId) {
    const images = await testPostImageUpload(postId);
    await testGetPostImages(postId);
    await testReorderPostImages(postId, images);
    if (images && images.length > 0) {
      await testDeletePostImage(postId, images[0].id);
    }
  }

  // Test media gallery
  await testMediaGallery();

  // Clean up profile picture
  await testProfilePictureDelete();

  console.log('\n=== Tests Complete ===');
}

// Run tests
runTests().catch(console.error);