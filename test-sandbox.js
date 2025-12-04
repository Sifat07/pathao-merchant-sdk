/**
 * Sandbox API Test Script
 * Tests the SDK against official Pathao sandbox environment
 */

const { PathaoApiService, DeliveryType, ItemType } = require('./dist/index.js');

async function testSandboxAPI() {
  console.log('🧪 Testing Pathao SDK against Sandbox API\n');
  console.log('=' .repeat(60));

  // Initialize with official sandbox credentials
  const pathao = new PathaoApiService({
    baseURL: 'https://courier-api-sandbox.pathao.com',
    clientId: '7N1aMJQbWm',
    clientSecret: 'wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39',
    username: 'test@pathao.com',
    password: 'lovePathao'
  });

  try {
    // Test 1: Get Cities
    console.log('\n📍 Test 1: Get Cities');
    console.log('-'.repeat(60));
    const cities = await pathao.getCities();
    console.log('✅ Cities Response Structure:');
    console.log(JSON.stringify(cities, null, 2));
    console.log(`Found ${cities.data.data.length} cities`);

    // Test 2: Get Zones
    if (cities.data.data.length > 0) {
      const cityId = cities.data.data[0].city_id;
      console.log(`\n🗺️  Test 2: Get Zones for City ID ${cityId} (${cities.data.data[0].city_name})`);
      console.log('-'.repeat(60));
      const zones = await pathao.getZones(cityId);
      console.log('✅ Zones Response Structure:');
      console.log(JSON.stringify(zones, null, 2));
      console.log(`Found ${zones.data.data.length} zones`);

      // Test 3: Get Areas
      if (zones.data.data.length > 0) {
        const zoneId = zones.data.data[0].zone_id;
        console.log(`\n📌 Test 3: Get Areas for Zone ID ${zoneId} (${zones.data.data[0].zone_name})`);
        console.log('-'.repeat(60));
        const areas = await pathao.getAreas(zoneId);
        console.log('✅ Areas Response Structure:');
        console.log(JSON.stringify(areas, null, 2));
        console.log(`Found ${areas.data.data.length} areas`);
      }
    }

    // Test 4: Get Stores
    console.log('\n🏪 Test 4: Get Stores');
    console.log('-'.repeat(60));
    const stores = await pathao.getStores();
    console.log('✅ Stores Response Structure:');
    console.log(JSON.stringify(stores, null, 2));
    console.log(`Found ${stores.data.data.length} stores`);

    // Test 5: Price Calculation
    if (stores.data.data.length > 0 && cities.data.data.length > 0) {
      const storeId = stores.data.data[0].store_id;
      console.log(`\n💰 Test 5: Price Calculation for Store ID ${storeId}`);
      console.log('-'.repeat(60));
      
      const zones = await pathao.getZones(cities.data.data[0].city_id);
      if (zones.data.data.length > 0) {
        const price = await pathao.calculatePrice({
          store_id: storeId,
          item_type: ItemType.PARCEL,
          item_weight: 0.5,
          delivery_type: DeliveryType.NORMAL,
          recipient_city: cities.data.data[0].city_id,
          recipient_zone: zones.data.data[0].zone_id
        });
        console.log('✅ Price Calculation Response Structure:');
        console.log(JSON.stringify(price, null, 2));
        console.log(`Price: ${price.data.price}, Final Price: ${price.data.final_price}`);
      }
    }

    // Test 6: Create Order (This might fail in sandbox if store is not approved)
    if (stores.data.data.length > 0) {
      const storeId = stores.data.data[0].store_id;
      console.log(`\n📦 Test 6: Create Order for Store ID ${storeId}`);
      console.log('-'.repeat(60));
      
      try {
        const order = await pathao.createOrder({
          store_id: storeId,
          merchant_order_id: `TEST-${Date.now()}`,
          recipient_name: 'Demo Recipient',
          recipient_phone: '01712345678',
          recipient_address: 'House 123, Road 4, Sector 10, Uttara, Dhaka-1230, Bangladesh',
          delivery_type: DeliveryType.NORMAL,
          item_type: ItemType.PARCEL,
          item_quantity: 1,
          item_weight: 0.5,
          item_description: 'Test item from SDK',
          amount_to_collect: 100
        });
        console.log('✅ Order Creation Response Structure:');
        console.log(JSON.stringify(order, null, 2));

        // Test 7: Get Order Status
        console.log(`\n🔍 Test 7: Get Order Status for ${order.data.consignment_id}`);
        console.log('-'.repeat(60));
        const status = await pathao.getOrderStatus(order.data.consignment_id);
        console.log('✅ Order Status Response Structure:');
        console.log(JSON.stringify(status, null, 2));
      } catch (error) {
        console.log('⚠️  Order creation failed (expected in sandbox if store not approved):');
        console.log(error.message);
      }
    }

    // Test 8: Create Store (might require special permissions)
    console.log('\n🏗️  Test 8: Create Store');
    console.log('-'.repeat(60));
    
    if (cities.data.data.length > 0) {
      const zones = await pathao.getZones(cities.data.data[0].city_id);
      if (zones.data.data.length > 0) {
        const areas = await pathao.getAreas(zones.data.data[0].zone_id);
        if (areas.data.data.length > 0) {
          try {
            const newStore = await pathao.createStore({
              name: `Test Store ${Date.now()}`,
              contact_name: 'Test Manager',
              contact_number: '01712345678',
              address: 'House 123, Road 4, Sector 10, Uttara, Dhaka-1230, Bangladesh',
              city_id: cities.data.data[0].city_id,
              zone_id: zones.data.data[0].zone_id,
              area_id: areas.data.data[0].area_id
            });
            console.log('✅ Store Creation Response Structure:');
            console.log(JSON.stringify(newStore, null, 2));
          } catch (error) {
            console.log('⚠️  Store creation failed (might require special permissions):');
            console.log(error.message);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Sandbox API Testing Completed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testSandboxAPI().catch(console.error);
