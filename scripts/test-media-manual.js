const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';

// IMPORTANT: Replace this with a valid JWT token from your app
// You can get this by:
// 1. Using your app's Google/Apple sign-in flow
// 2. Copying the token from the network tab in browser dev tools
// 3. Or from your app's storage after signing in
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE';

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

async function testEndpoints() {
  if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.error('Please set AUTH_TOKEN in this script first!');
    console.log('\nHow to get a token:');
    console.log('1. Sign in to your app using Google/Apple auth');
    console.log('2. Check browser dev tools Network tab for auth requests');
    console.log('3. Copy the JWT token from the response');
    console.log('4. Replace AUTH_TOKEN in this script');
    return;
  }

  console.log('Testing Media Upload Endpoints...\n');

  // Test 1: Check if authenticated
  try {
    console.log('1. Testing authentication...');
    const meResponse = await axios.get(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    console.log('✓ Authentication successful:', meResponse.data.data.user.email);
  } catch (error) {
    console.error('✗ Authentication failed:', error.response?.data || error.message);
    return;
  }

  // Test 2: Upload profile picture
  try {
    console.log('\n2. Testing profile picture upload...');
    const imagePath = createTestImage();
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath), 'profile-pic.png');

    const response = await axios.post(
      `${API_BASE}/users/media/profile-picture`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${AUTH_TOKEN}`
        }
      }
    );

    console.log('✓ Profile picture uploaded:', response.data.data.profilePic);
    fs.unlinkSync(imagePath);
  } catch (error) {
    console.error('✗ Profile picture upload failed:', error.response?.data || error.message);
  }

  // Test 3: Check media routes exist
  console.log('\n3. Available media endpoints:');
  console.log('- POST   /api/users/media/profile-picture');
  console.log('- DELETE /api/users/media/profile-picture');
  console.log('- POST   /api/users/media/banner');
  console.log('- POST   /api/posts/:postId/images');
  console.log('- GET    /api/posts/:postId/images');
  console.log('- PUT    /api/posts/:postId/images/reorder');
  console.log('- DELETE /api/posts/:postId/images/:imageId');
  console.log('- GET    /api/media/gallery');

  console.log('\nFor full testing, update AUTH_TOKEN and run this script.');
}

testEndpoints().catch(console.error);