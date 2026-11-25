require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sequelize, Bot, ChatbotCategory, ChatbotItem } = require('../models');

const dcsData = [
  {
    name: 'Construction & Mining',
    display_order: 1,
    status: 'active',
    items: [
      { name: 'Kennametal', type: 'brand' },
      { name: 'Wonkang', type: 'brand' },
      { name: 'Pilling Tools', type: 'brand' },
      { name: 'Doofor', type: 'brand' },
      { name: 'P&V', type: 'brand' },
      { name: 'Rock.Zone', type: 'brand' },
      { name: 'Soosan', type: 'brand' },
      { name: 'Wimmer', type: 'brand' },
      { name: 'Delta X', type: 'brand' },
      { name: 'Gecko', type: 'brand' },
      { name: 'Power Tools', type: 'brand' },
      { name: 'SANX', type: 'brand' },
      { name: 'Feurst', type: 'brand' }
    ]
  },
  {
    name: 'Hydraulic Attachments & Breakers',
    display_order: 2,
    status: 'active',
    items: [
      { name: 'Dynaset', type: 'brand' },
      { name: 'Indeco', type: 'brand' },
      { name: 'Sterling', type: 'brand' }
    ]
  },
  {
    name: 'Renewable Energy Solutions',
    display_order: 3,
    status: 'active',
    items: [
      { name: 'Next Automation', type: 'brand' },
      { name: 'Taypro', type: 'brand' }
    ]
  },
  {
    name: 'Sustainability & Waste Management Solutions',
    display_order: 4,
    status: 'active',
    items: [
      { name: 'Sewage Treatment Plant (STP)', type: 'service' },
      { name: 'Effluent Treatment Plant (ETP)', type: 'service' },
      { name: 'Organic Waste Composter (OWC)', type: 'service' }
    ]
  },
  {
    name: 'Filtration Solutions',
    display_order: 5,
    status: 'active',
    items: [
      { name: 'Turbo Precleaners', type: 'brand' },
      { name: 'Donaldson', type: 'brand' }
    ]
  },
  {
    name: 'Safety & Control Systems',
    display_order: 6,
    status: 'active',
    items: [
      { name: 'AMCS', type: 'brand' }
    ]
  }
];

async function seed() {
  try {
    console.log('Connecting to database and synchronizing schema...');
    // Sync models - additive, safe alteration
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');

    // Find all bots or target bot
    const bots = await Bot.findAll();
    if (bots.length === 0) {
      console.log('No bots found. Please create a bot first or run after bot creation.');
      process.exit(0);
    }

    console.log(`Found ${bots.length} bot(s). Seeding DCS menu for bot(s)...`);

    for (const bot of bots) {
      console.log(`\n--- Seeding Bot ID: ${bot.id} (${bot.name}) ---`);

      for (const catData of dcsData) {
        // Find or create category
        const [category, catCreated] = await ChatbotCategory.findOrCreate({
          where: {
            bot_id: bot.id,
            name: catData.name
          },
          defaults: {
            bot_id: bot.id,
            name: catData.name,
            display_order: catData.display_order,
            status: catData.status
          }
        });

        console.log(`  Category [${category.name}]: ${catCreated ? 'CREATED' : 'ALREADY EXISTS'} (ID: ${category.id})`);

        // Seed items
        let itemOrder = 1;
        for (const itemData of catData.items) {
          const [item, itemCreated] = await ChatbotItem.findOrCreate({
            where: {
              category_id: category.id,
              name: itemData.name
            },
            defaults: {
              category_id: category.id,
              name: itemData.name,
              type: itemData.type,
              display_order: itemOrder++,
              status: 'active'
            }
          });

          if (itemCreated) {
            console.log(`    + Item [${item.name}] (${item.type}) created.`);
          }
        }
      }
    }

    console.log('\nDCS Guided Menu seeding completed successfully without any data loss!');
    process.exit(0);
  } catch (error) {
    console.error('Error during DCS migration/seeding:', error);
    process.exit(1);
  }
}

seed();
