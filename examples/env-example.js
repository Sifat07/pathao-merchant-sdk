/**
 * Example: Using Pathao SDK with Environment Variables
 * 
 * This example shows how to use the Pathao SDK with environment variables
 * for both sandbox and live environments.
 */

const { PathaoApiService, DeliveryType, ItemType } = require('../dist/index.js');

async function exampleWithEnvVars() {
  console.log('🚀 Pathao SDK with Environment Variables Example\n');
  
  // The SDK will automatically use PATHAO_BASE_URL from environment variables
  // If not set, it defaults to the live URL: https://api-hermes.pathao.com
  
  const pathao = new PathaoApiService({
    baseURL: process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com',
    clientId: process.env.PATHAO_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.PATHAO_CLIENT_SECRET || 'your-client-secret',
    username: process.env.PATHAO_USERNAME || 'your-username',
    password: process.env.PATHAO_PASSWORD || 'your-password'
  });

  try {
    console.log('🔐 Testing Authentication...');
    const cities = await pathao.getCities();
    console.log(`✅ Authentication successful! Found ${cities.data.data.length} cities`);
    
    console.log('\n📊 Current Configuration:');
    console.log(`- Base URL: ${pathao['config'].baseURL}`);
    console.log(`- Client ID: ${pathao['config'].clientId}`);
    console.log(`- Username: ${pathao['config'].username}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Example environment variables you can set:
console.log('📝 Environment Variables:');
console.log('PATHAO_BASE_URL=https://courier-api-sandbox.pathao.com  # For sandbox');
console.log('PATHAO_BASE_URL=https://api-hermes.pathao.com           # For live (default)');
console.log('PATHAO_CLIENT_ID=your-client-id');
console.log('PATHAO_CLIENT_SECRET=your-client-secret');
console.log('PATHAO_USERNAME=your-username');
console.log('PATHAO_PASSWORD=your-password');
console.log('');

exampleWithEnvVars();
