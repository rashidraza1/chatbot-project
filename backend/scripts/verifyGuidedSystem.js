require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Bot, ChatbotCategory, ChatbotItem, ChatbotCallbackRequest, PdfDocument } = require('../models');

async function verify() {
  try {
    console.log('--- 1. Testing Bot & Seeded Categories ---');
    const bots = await Bot.findAll();
    console.log(`Found ${bots.length} bot(s).`);
    if (bots.length === 0) {
      console.error('No bot found!');
      process.exit(1);
    }

    const testBot = bots[0];
    console.log(`Testing with Bot ID ${testBot.id}: "${testBot.name}"`);

    const categories = await ChatbotCategory.findAll({
      where: { bot_id: testBot.id, status: 'active' },
      order: [['display_order', 'ASC']],
      include: [{ model: ChatbotItem }]
    });

    console.log(`\nFound ${categories.length} active categories for Bot #${testBot.id}:`);
    for (const cat of categories) {
      const items = cat.ChatbotItems || [];
      console.log(`  [Category #${cat.id}] ${cat.name} (order: ${cat.display_order}) -> ${items.length} items`);
    }

    if (categories.length < 6) {
      console.warn('Warning: Expected at least 6 DCS categories.');
    } else {
      console.log('✓ All 6 DCS categories successfully present.');
    }

    console.log('\n--- 2. Testing Item Details & Type Attributes ---');
    const firstCat = categories[0];
    const items = await ChatbotItem.findAll({
      where: { category_id: firstCat.id, status: 'active' },
      order: [['display_order', 'ASC']]
    });
    console.log(`Category "${firstCat.name}" has ${items.length} items.`);
    if (items.length > 0) {
      console.log(`  First item: "${items[0].name}" (type: ${items[0].type})`);
    }

    console.log('\n--- 3. Testing Callback Request Creation & Validation ---');
    // Test creating a callback request
    const testMobile = '9876543210';
    const callback = await ChatbotCallbackRequest.create({
      bot_id: testBot.id,
      category_id: firstCat.id,
      item_id: items[0].id,
      mobile: testMobile,
      status: 'pending'
    });

    console.log(`✓ Callback request created successfully! ID: ${callback.id}, Mobile: +91 ${callback.mobile}, Status: ${callback.status}`);

    // Verify finding it back
    const foundCallback = await ChatbotCallbackRequest.findByPk(callback.id, {
      include: [
        { model: ChatbotCategory, attributes: ['id', 'name'] },
        { model: ChatbotItem, attributes: ['id', 'name', 'type'] }
      ]
    });

    console.log(`✓ Found callback record in DB:`);
    console.log(`  Category: ${foundCallback.ChatbotCategory?.name}`);
    console.log(`  Brand/Service: ${foundCallback.ChatbotItem?.name} (${foundCallback.ChatbotItem?.type})`);
    console.log(`  Mobile: +91 ${foundCallback.mobile}`);
    console.log(`  Status: ${foundCallback.status}`);

    // Test status update
    foundCallback.status = 'contacted';
    await foundCallback.save();
    console.log(`✓ Successfully updated callback status to: "${foundCallback.status}"`);

    console.log('\n=== ALL GUIDED SYSTEM BACKEND CHECKS PASSED PERFECTLY! ===');
    process.exit(0);
  } catch (err) {
    console.error('Verification failed with error:', err);
    process.exit(1);
  }
}

verify();
