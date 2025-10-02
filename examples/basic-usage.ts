/**
 * Basic usage example for @sifat07/pathao-merchant-sdk
 * 
 * This example demonstrates how to use the Pathao SDK to:
 * 1. Initialize the service
 * 2. Calculate delivery price
 * 3. Create a delivery order
 * 4. Track order status
 */

import { PathaoApiService, DeliveryType, ItemType } from '../src/index';

async function basicUsageExample() {
  // Initialize the Pathao service
  const pathao = new PathaoApiService({
    baseURL: process.env.PATHAO_BASE_URL!,
    clientId: process.env.PATHAO_CLIENT_ID!,
    clientSecret: process.env.PATHAO_CLIENT_SECRET!,
    username: process.env.PATHAO_USERNAME!,
    password: process.env.PATHAO_PASSWORD!
  });

  try {
    console.log('🚀 Pathao SDK Basic Usage Example\n');

    // 1. Get available cities and areas
    console.log('📍 Fetching cities and areas...');
    const cities = await pathao.getCities();
    console.log('Available cities:', cities.data.data.length);

    // Get zones for first city
    if (cities.data.data.length > 0) {
      const zones = await pathao.getZones(cities.data.data[0].city_id);
      console.log('Available zones for', cities.data.data[0].city_name, ':', zones.data.data.length);
      
      // Get areas for first zone
      if (zones.data.data.length > 0) {
        const areas = await pathao.getAreas(zones.data.data[0].zone_id);
        console.log('Available areas for', zones.data.data[0].zone_name, ':', areas.data.data.length);
      }
    }

    // 2. Calculate delivery price
    console.log('\n💰 Calculating delivery price...');
    const price = await pathao.calculatePrice({
      store_id: 123, // Replace with your actual store ID
      item_type: ItemType.PARCEL,
      item_weight: 1.0,
      delivery_type: DeliveryType.NORMAL,
      recipient_city: 1, // Dhaka
      recipient_zone: 1, // Dhanmondi
      recipient_area: 1  // Dhanmondi 27
    });

    console.log('Price calculation result:', {
      price: price.data.price,
      discount: price.data.discount,
      promo_discount: price.data.promo_discount,
      cod_enabled: price.data.cod_enabled,
      cod_percentage: price.data.cod_percentage,
      additional_charge: price.data.additional_charge,
      final_price: price.data.final_price
    });

    // 3. Create a delivery order
    console.log('\n📦 Creating delivery order...');
    const order = await pathao.createOrder({
      store_id: 123, // Replace with your actual store ID
      merchant_order_id: `ORDER-${Date.now()}`,
      recipient_name: 'John Doe',
      recipient_phone: '01712345678',
      recipient_address: '123 Main Street, Dhanmondi, Dhaka',
      delivery_type: DeliveryType.NORMAL,
      item_type: ItemType.PARCEL,
      item_quantity: 1,
      item_weight: 1.0,
      amount_to_collect: 500,
      special_instruction: 'Call before delivery'
    });

    console.log('Order created successfully:', {
      consignment_id: order.data.consignment_id,
      merchant_order_id: order.data.merchant_order_id,
      order_status: order.data.order_status,
      delivery_fee: order.data.delivery_fee
    });

    // 4. Track order status
    console.log('\n🔍 Tracking order status...');
    const status = await pathao.getOrderStatus(order.data.consignment_id);
    console.log('Current order status:', status.data.order_status);

    console.log('\n✅ Example completed successfully!');

  } catch (error) {
    console.error('❌ Error occurred:', error instanceof Error ? error.message : String(error));
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };
