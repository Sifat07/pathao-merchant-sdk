/**
 * Simple usage example for @sifat07/pathao-merchant-sdk
 * 
 * This example shows how to use the Pathao SDK in a basic Node.js application.
 */

const { PathaoApiService, DeliveryType, ItemType } = require('@sifat07/pathao-merchant-sdk');

async function simpleExample() {
  // Initialize the Pathao service
  const pathao = new PathaoApiService({
    clientId: process.env.PATHAO_CLIENT_ID,
    clientSecret: process.env.PATHAO_CLIENT_SECRET,
    username: process.env.PATHAO_USERNAME,
    password: process.env.PATHAO_PASSWORD
  });

  try {
    console.log('🚀 Pathao SDK Simple Example\n');

    // Create a delivery order
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
      amount_to_collect: 500
    });

    console.log('Order created successfully:', {
      consignmentId: order.data.consignment_id,
      invoiceId: order.data.invoice_id,
      status: order.data.status
    });

  } catch (error) {
    console.error('Error occurred:', error.message);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  simpleExample().catch(console.error);
}

module.exports = { simpleExample };
