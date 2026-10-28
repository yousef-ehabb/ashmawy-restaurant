/**
 * Ashmawy Restaurant - Firestore Catalog Seed Script
 * Migrates static data from src/data/menu.ts into Firestore live collections:
 * - categories (9 documents)
 * - products (42 documents)
 * - option_groups (product-level option groups for sizes and extras)
 * - options (individual options under groups)
 * - settings/global (restaurant branch & global settings)
 * - counters/order_counter (sequential counter starting at 1000)
 */

import fs from 'fs';
import os from 'os';
import https from 'https';

// 1. Authenticate using Firebase CLI session
const configPath = `${os.homedir()}/.config/configstore/firebase-tools.json`;
if (!fs.existsSync(configPath)) {
  console.error('Firebase CLI config not found at', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config?.tokens?.access_token;
if (!token) {
  console.error('No OAuth access token found in Firebase CLI config');
  process.exit(1);
}

const PROJECT_ID = 'ashmawy-ordering';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: 'NULL_VALUE' };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue),
      },
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

const agent = new https.Agent({ keepAlive: true, maxSockets: 5 });

async function upsertDocumentWithRetry(collection, docId, data, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}`;
        const fields = {};
        for (const [k, v] of Object.entries(data)) {
          if (v !== undefined) {
            fields[k] = toFirestoreValue(v);
          }
        }
        const payload = JSON.stringify({ fields });

        const req = https.request(
          url,
          {
            agent,
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
            timeout: 15000,
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ collection, docId, ok: true });
              } else {
                reject(new Error(`Failed ${collection}/${docId} (${res.statusCode}): ${body}`));
              }
            });
          }
        );

        req.on('timeout', () => {
          req.destroy(new Error('Request timed out'));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delayMs = attempt * 500;
      console.warn(`    ⚠️ [Retry ${attempt}/${maxRetries}] ${collection}/${docId}: ${err.message}. Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

const upsertDocument = upsertDocumentWithRetry;

// 2. Data Definitions
const categories = [
  { id: 'chicken-crepes', name_ar: 'كريبات الفراخ', name_en: 'Chicken Crepes', sort_order: 1, is_active: true },
  { id: 'crispy-crepes', name_ar: 'كريبات الفرايد تشكن', name_en: 'Crispy Crepes', sort_order: 2, is_active: true },
  { id: 'cheese-crepes', name_ar: 'كريبات جبنة خفيفة', name_en: 'Light Cheese', sort_order: 3, is_active: true },
  { id: 'meals', name_ar: 'وجبات عشماوي', name_en: 'Meals', sort_order: 4, is_active: true },
  { id: 'sandwiches', name_ar: 'ساندوتشات', name_en: 'Sandwiches', sort_order: 5, is_active: true },
  { id: 'pizza-crepes', name_ar: 'بيتزا كريب', name_en: 'Pizza Crepe', sort_order: 6, is_active: true },
  { id: 'sides', name_ar: 'المقبلات', name_en: 'Sides', sort_order: 7, is_active: true },
  { id: 'additions', name_ar: 'الإضافات', name_en: 'Additions', sort_order: 8, is_active: true },
  { id: 'drinks', name_ar: 'المشروبات', name_en: 'Drinks', sort_order: 9, is_active: true },
];

const extrasList = [
  { id: 'x-kono', name_ar: 'كونو', name_en: 'Kono', price: 20 },
  { id: 'x-bigtasty', name_ar: 'صوص بيج تستي', name_en: 'Big Tasty', price: 20 },
  { id: 'x-potatoes', name_ar: 'بطاطس', name_en: 'Potatoes', price: 15 },
  { id: 'x-ranch', name_ar: 'صوص رانش', name_en: 'Ranch sauce', price: 20 },
  { id: 'x-cheddar', name_ar: 'صوص شيدر', name_en: 'Cheddar sauce', price: 20 },
  { id: 'x-smoked', name_ar: 'بيف مدخن', name_en: 'Smoked beef', price: 15 },
  { id: 'x-burger', name_ar: 'برجر بيف', name_en: 'Beef burger', price: 50 },
  { id: 'x-hotdog', name_ar: 'هوت دوج', name_en: 'Hot dog', price: 20 },
  { id: 'x-kiri', name_ar: 'جبنة كيري', name_en: 'Kiri cheese', price: 15 },
  { id: 'x-roman', name_ar: 'جبنة رومي', name_en: 'Roman cheese', price: 15 },
];

const rawProducts = [
  // chicken-crepes
  { id: 'c1', category_id: 'chicken-crepes', name_ar: 'كريب عشماوي', name_en: 'Crepe Ashmawy', price: 145, description_ar: 'موتزريلا، كريسبي فريش، صدور فراخ، بطاطس، كونو موتزريلا، خضار، كاتشب، مايونيز', image_url: '/assets/crepe-chicken.jpg', customizable: true },
  { id: 'c2', category_id: 'chicken-crepes', name_ar: 'كريب ولعها حار', name_en: 'Crepe Wala3ha', price: 155, description_ar: 'موتزريلا، زنجر حار، شاورما فراخ، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-chicken.jpg', tags: ['spicy'], customizable: true },
  { id: 'c3', category_id: 'chicken-crepes', name_ar: 'ميكس فراخ', name_en: 'Mix Chicken', price: 130, description_ar: 'موتزريلا، كريسبي فريش، شاورما فراخ، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-chicken.jpg', customizable: true },
  { id: 'c4', category_id: 'chicken-crepes', name_ar: 'ميكس فاهيتا', name_en: 'Fahita Mix', price: 130, description_ar: 'موتزريلا، فاهيتا فراخ، هوت دوج، باربيكيو، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-chicken.jpg', customizable: true },
  { id: 'c5', category_id: 'chicken-crepes', name_ar: 'ميكس جبن وفراخ', name_en: 'Mix Cheese and Chicken', price: 145, description_ar: 'موتزريلا، قطع كريسبي فريش، صوص شيدر، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-chicken.jpg', customizable: true },
  { id: 'c6', category_id: 'chicken-crepes', name_ar: 'شاورما فراخ جريل', name_en: 'Chicken Shawarma', price: 135, description_ar: 'موتزريلا، شاورما فراخ، خضار، كاتشب، مايونيز', image_url: '/assets/crepe-chicken.jpg', customizable: true },
  { id: 'c7', category_id: 'chicken-crepes', name_ar: 'فاهيتا فراخ', name_en: 'Chicken Fahita', price: 135, description_ar: 'موتزريلا، فاهيتا فراخ، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-chicken.jpg', customizable: true },
  { id: 'c8', category_id: 'chicken-crepes', name_ar: 'ميكس لحوم', name_en: 'Meat Mix', price: 155, description_ar: 'موتزريلا، هوت دوج، سجق، برجر بيف، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-chicken.jpg', customizable: true },

  // crispy-crepes
  { id: 'k1', category_id: 'crispy-crepes', name_ar: 'كريسبي فريش', name_en: 'Crispy Fresh', price: 135, description_ar: 'موتزريلا، قطع كريسبي فريش، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-crispy.jpg', customizable: true },
  { id: 'k2', category_id: 'crispy-crepes', name_ar: 'زنجر حار فريش', name_en: 'Hot Zinger Fresh', price: 145, description_ar: 'موتزريلا، قطع زنجر حار، خضار، كاتشب، كابوتشي، مايونيز', image_url: '/assets/crepe-crispy.jpg', tags: ['spicy'], customizable: true },
  { id: 'k3', category_id: 'crispy-crepes', name_ar: 'ميكس كريسبي على زنجر فريش', name_en: 'Fresh Crispy & Zinger Fresh', price: 140, description_ar: 'موتزريلا، زنجر حار، كريسبي فريش، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-crispy.jpg', customizable: true },
  { id: 'k4', category_id: 'crispy-crepes', name_ar: 'كريسبي بيج تيستي', name_en: 'Big Tasty Crispy', price: 140, description_ar: 'موتزريلا، قطع كريسبي فريش، صوص البيج تيستي، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-crispy.jpg', customizable: true },
  { id: 'k5', category_id: 'crispy-crepes', name_ar: 'كريسبي كونو', name_en: 'Cone Crispy', price: 140, description_ar: 'موتزريلا، قطع كريسبي فريش، كونو موتزريلا، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-crispy.jpg', customizable: true },
  { id: 'k6', category_id: 'crispy-crepes', name_ar: 'سوبر كرانشي صوص شيدر', name_en: 'Super Crunchy Cheddar', price: 150, description_ar: 'موتزريلا، قطع كريسبي فريش، خضار، صوص شيدر، كابوتشي، كاتشب، مايونيز', image_url: '/assets/crepe-crispy.jpg', customizable: true },
  { id: 'k7', category_id: 'crispy-crepes', name_ar: 'أباتشي', name_en: 'Apache Crepe', price: 185, description_ar: 'موتزريلا، قطع كريسبي فريش، صدور فراخ، برجر بيف، خضار، كابوتشي، صوص شيدر، صوص أمريكان تكساس', image_url: '/assets/crepe-crispy.jpg', tags: ['new'], customizable: true },
  { id: 'k8', category_id: 'crispy-crepes', name_ar: 'رانشيز', name_en: 'Ranches', price: 160, description_ar: 'موتزريلا، قطع كريسبي فريش، سلامي، كابوتشي، صوص رانش، كاتشب، مايونيز', image_url: '/assets/crepe-crispy.jpg', tags: ['new'], customizable: true },

  // cheese-crepes
  { id: 'l1', category_id: 'cheese-crepes', name_ar: 'ميكس جبن', name_en: 'Mix Cheese', price: 120, description_ar: 'موتزريلا، رومي، كيري، صوص شيدر، زيتون، كاتشب، مايونيز', image_url: '/assets/fries-loaded.jpg', customizable: true },
  { id: 'l2', category_id: 'cheese-crepes', name_ar: 'بطاطس موتزريلا', name_en: 'Mozzarella Fries', price: 90, description_ar: 'موتزريلا، بطاطس، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/fries-loaded.jpg', customizable: true },
  { id: 'l3', category_id: 'cheese-crepes', name_ar: 'جبن بطاطس', name_en: 'Fries Cheese', price: 105, description_ar: 'موتزريلا، صوص شيدر، بطاطس، خضار، كابوتشي، كاتشب، مايونيز', image_url: '/assets/fries-loaded.jpg', customizable: true },

  // meals
  { id: 'm4', category_id: 'meals', name_ar: 'وجبة 4 قطع', name_en: 'Meal 4 Pieces', price: 150, description_ar: '4 قطع دجاج مقرمش مع بطاطس، خبز وثومية', image_url: '/assets/meal-chicken.jpg' },
  { id: 'm6', category_id: 'meals', name_ar: 'وجبة 6 قطع', name_en: 'Meal 6 Pieces', price: 230, description_ar: '6 قطع دجاج مقرمش مع بطاطس، خبز وثومية', image_url: '/assets/meal-chicken.jpg' },
  { id: 'm8', category_id: 'meals', name_ar: 'وجبة 8 قطع', name_en: 'Meal 8 Pieces', price: 300, description_ar: '8 قطع دجاج مقرمش مع بطاطس عائلية، خبز وثومية', image_url: '/assets/meal-chicken.jpg' },

  // sandwiches
  {
    id: 's1',
    category_id: 'sandwiches',
    name_ar: 'ساندوتش هامر',
    name_en: 'Hammer Sandwich',
    price: 145,
    description_ar: 'قطع الدجاج المقرمش بخلطة عشماوي السرية، جبن شيدر، شرائح بيف مدخن، كابوتشي',
    image_url: '/assets/sandwich.jpg',
    customizable: true,
    sizes: [
      { id: 'S', label: 'سينجل (S)', price: 145 },
      { id: 'D', label: 'دبل (D)', price: 200 },
      { id: 'T', label: 'تريبل (T)', price: 330 },
    ],
  },
  {
    id: 's2',
    category_id: 'sandwiches',
    name_ar: 'ساندوتش بيف برجر',
    name_en: 'Beef Burger Sandwich',
    price: 150,
    description_ar: 'بيف برجر، شرائح بيف مدخن، كابوتشي، صوص تكساس برجر، صوص شيدر',
    image_url: '/assets/sandwich.jpg',
    customizable: true,
    sizes: [
      { id: 'S', label: 'سينجل (S)', price: 150 },
      { id: 'D', label: 'دبل (D)', price: 200 },
      { id: 'T', label: 'تريبل (T)', price: 370 },
    ],
  },
  {
    id: 's3',
    category_id: 'sandwiches',
    name_ar: 'ساندوتش أربي جي',
    name_en: 'RBG Sandwich',
    price: 220,
    description_ar: 'قطع الدجاج المقرمش بخلطة عشماوي السرية، بيف برجر، شرائح بيف مدخن، كابوتشي، صوص شيدر، صوص تكساس برجر',
    image_url: '/assets/sandwich.jpg',
    customizable: true,
    sizes: [{ id: 'D', label: 'دبل (D)', price: 220 }],
  },

  // pizza-crepes
  { id: 'p1', category_id: 'pizza-crepes', name_ar: 'بيتزا كريب ميكس فراخ', name_en: 'Pizza Crepe Mix Chicken', price: 370, description_ar: 'بيتزا كريب محشوة ميكس فراخ مع أجبان وزيتون', image_url: '/assets/pizza-crepe.jpg', customizable: true },
  { id: 'p2', category_id: 'pizza-crepes', name_ar: 'بيتزا كريب كريسبي', name_en: 'Crispy Crepe Pizza', price: 360, description_ar: 'بيتزا كريب كريسبي بخلطة الأجبان المميزة', image_url: '/assets/pizza-crepe.jpg', customizable: true },

  // sides
  { id: 'a1', category_id: 'sides', name_ar: 'باكت بطاطس', name_en: 'Fries Box', price: 25, description_ar: 'بطاطس مقلية ذهبية مقرمشة', image_url: '/assets/fries-loaded.jpg' },
  { id: 'a2', category_id: 'sides', name_ar: 'باكت كريسبي صوص شيدر', name_en: 'Crispy Box · Cheddar', price: 100, description_ar: 'قطع كريسبي مع صوص شيدر غني', image_url: '/assets/fries-loaded.jpg' },
  { id: 'a3', category_id: 'sides', name_ar: 'باكت كريسبي صوص بيج تستي', name_en: 'Crispy Box · Big Tasty', price: 100, description_ar: 'قطع كريسبي مع صوص بيج تستي الشهير', image_url: '/assets/fries-loaded.jpg' },
  { id: 'a4', category_id: 'sides', name_ar: 'باكت كريسبي صوص رانش', name_en: 'Crispy Box · Ranch', price: 100, description_ar: 'قطع كريسبي مع صوص رانش اللذيذ', image_url: '/assets/fries-loaded.jpg' },

  // additions (products under category 'additions')
  ...extrasList.map((e) => ({
    id: e.id,
    category_id: 'additions',
    name_ar: e.name_ar,
    name_en: e.name_en,
    price: e.price,
    description_ar: `إضافة ${e.name_ar}`,
    image_url: '/assets/extras.jpg',
  })),

  // drinks
  { id: 'd1', category_id: 'drinks', name_ar: 'كولا', name_en: 'Cola', price: 25, description_ar: 'مشروب غازي منعش', image_url: '/assets/extras.jpg' },
  { id: 'd2', category_id: 'drinks', name_ar: 'مياه', name_en: 'Water', price: 10, description_ar: 'مياه معدنية نقية', image_url: '/assets/extras.jpg' },
];

async function seed() {
  console.log(`Starting Firestore migration for ${PROJECT_ID}...`);

  // 1. Seed Categories
  console.log('\n--- Seeding Categories ---');
  for (const cat of categories) {
    await upsertDocument('categories', cat.id, cat);
    console.log(`  ✓ Category: ${cat.name_ar} (${cat.id})`);
  }

  // 2. Seed Products and Option Groups
  console.log('\n--- Seeding Products & Option Groups ---');
  let optionGroupCount = 0;
  let optionsCount = 0;

  for (const prod of rawProducts) {
    const productData = {
      id: prod.id,
      category_id: prod.category_id,
      name_ar: prod.name_ar,
      name_en: prod.name_en || '',
      description_ar: prod.description_ar || '',
      price: prod.price,
      image_url: prod.image_url,
      is_available: true,
      is_active: true,
      tags: prod.tags || [],
      customizable: Boolean(prod.customizable),
      branch_availability: {
        'فرع المطار': true,
        'فرع المحطة': true,
      },
      created_at: new Date().toISOString(),
    };

    await upsertDocument('products', prod.id, productData);
    console.log(`  ✓ Product: ${prod.name_ar} (${prod.id})`);

    // Sizes option group
    if (prod.sizes && prod.sizes.length > 0) {
      const groupId = `${prod.id}_sizes`;
      const groupDoc = {
        id: groupId,
        product_id: prod.id,
        key: 'size',
        name_ar: 'الحجم',
        name_en: 'Size',
        min_select: 1,
        max_select: 1,
        is_active: true,
        sort_order: 1,
      };
      await upsertDocument('option_groups', groupId, groupDoc);
      optionGroupCount++;

      for (let i = 0; i < prod.sizes.length; i++) {
        const s = prod.sizes[i];
        const optId = `${prod.id}_size_${s.id}`;
        const optDoc = {
          id: optId,
          group_id: groupId,
          product_id: prod.id,
          name_ar: s.label,
          price_delta: s.price - prod.price,
          is_active: true,
          sort_order: i + 1,
          branch_availability: {
            'فرع المطار': true,
            'فرع المحطة': true,
          },
        };
        await upsertDocument('options', optId, optDoc);
        optionsCount++;
      }
    }

    // Extras option group for customizable items
    if (prod.customizable) {
      const groupId = `${prod.id}_extras`;
      const groupDoc = {
        id: groupId,
        product_id: prod.id,
        key: 'extras',
        name_ar: 'إضافات ومشروبات',
        name_en: 'Extras & Additions',
        min_select: 0,
        max_select: 5,
        is_active: true,
        sort_order: 2,
      };
      await upsertDocument('option_groups', groupId, groupDoc);
      optionGroupCount++;

      for (let i = 0; i < extrasList.length; i++) {
        const ext = extrasList[i];
        const optId = `${prod.id}_extra_${ext.id}`;
        const optDoc = {
          id: optId,
          group_id: groupId,
          product_id: prod.id,
          name_ar: ext.name_ar,
          name_en: ext.name_en,
          price_delta: ext.price,
          is_active: true,
          sort_order: i + 1,
          branch_availability: {
            'فرع المطار': true,
            'فرع المحطة': true,
          },
        };
        await upsertDocument('options', optId, optDoc);
        optionsCount++;
      }
    }
  }

  // 3. Seed Settings/Global
  console.log('\n--- Seeding Settings ---');
  const globalSettings = {
    is_website_open: true,
    closed_message: 'المطعم مغلق حالياً، نسعد باستقبال طلباتكم خلال مواعيد العمل الرسمية.',
    delivery_fee: 15,
    min_order_amount: 50,
    branches: {
      'فرع المطار': {
        name: 'فرع المطار',
        is_open: true,
        auto_close_enabled: true,
        delivery_fee: 15,
        phone: '01150000000',
      },
      'فرع المحطة': {
        name: 'فرع المحطة',
        is_open: true,
        auto_close_enabled: true,
        delivery_fee: 15,
        phone: '01150000001',
      },
    },
    updated_at: new Date().toISOString(),
  };
  await upsertDocument('settings', 'global', globalSettings);
  console.log('  ✓ settings/global created with branches: فرع المطار, فرع المحطة');

  // 4. Seed Counters/OrderCounter
  console.log('\n--- Seeding Order Counter ---');
  await upsertDocument('counters', 'order_counter', {
    current_number: 1000,
    updated_at: new Date().toISOString(),
  });
  console.log('  ✓ counters/order_counter set to starting number 1000');

  console.log('\n=========================================');
  console.log('🎉 Firestore Seed Completed Successfully!');
  console.log(`- Categories: ${categories.length}`);
  console.log(`- Products: ${rawProducts.length}`);
  console.log(`- Option Groups: ${optionGroupCount}`);
  console.log(`- Options: ${optionsCount}`);
  console.log('- Settings & Counter documents initialized');
  console.log('=========================================\n');
}

seed().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
