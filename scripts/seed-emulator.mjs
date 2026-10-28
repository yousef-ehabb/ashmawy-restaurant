/**
 * Ashmawy Restaurant - Firestore Emulator Seed Script
 * Uses firebase-admin to seed the local Firestore emulator on 127.0.0.1:8081
 * with all 42 products, 9 categories, option groups, options, settings, and counter.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8081';

const app = getApps().length === 0 ? initializeApp({ projectId: 'ashmawy-ordering' }) : getApps()[0];
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

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

  // additions
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

async function seedEmulator() {
  console.log('Seeding Firestore Emulator on 127.0.0.1:8081...');

  const batch = db.batch();

  // 1. Categories
  for (const cat of categories) {
    batch.set(db.collection('categories').doc(cat.id), cat);
  }

  // 2. Settings
  batch.set(db.collection('settings').doc('global'), {
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
  });

  // 3. Counter
  batch.set(db.collection('counters').doc('order_counter'), {
    current_number: 1000,
    updated_at: new Date().toISOString(),
  });

  await batch.commit();
  console.log('Categories, Settings, and Counter seeded.');

  // 4. Products and Options
  for (const prod of rawProducts) {
    const pRef = db.collection('products').doc(prod.id);
    await pRef.set({
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
    });

    if (prod.sizes && prod.sizes.length > 0) {
      const gRef = db.collection('option_groups').doc(`${prod.id}_sizes`);
      await gRef.set({
        id: `${prod.id}_sizes`,
        product_id: prod.id,
        key: 'size',
        name_ar: 'الحجم',
        name_en: 'Size',
        min_select: 1,
        max_select: 1,
        is_active: true,
        sort_order: 1,
      });

      for (let i = 0; i < prod.sizes.length; i++) {
        const s = prod.sizes[i];
        const optId = `${prod.id}_size_${s.id}`;
        await db.collection('options').doc(optId).set({
          id: optId,
          group_id: `${prod.id}_sizes`,
          product_id: prod.id,
          name_ar: s.label,
          price_delta: s.price - prod.price,
          is_active: true,
          sort_order: i + 1,
          branch_availability: {
            'فرع المطار': true,
            'فرع المحطة': true,
          },
        });
      }
    }

    if (prod.customizable) {
      const gRef = db.collection('option_groups').doc(`${prod.id}_extras`);
      await gRef.set({
        id: `${prod.id}_extras`,
        product_id: prod.id,
        key: 'extras',
        name_ar: 'إضافات ومشروبات',
        name_en: 'Extras & Additions',
        min_select: 0,
        max_select: 5,
        is_active: true,
        sort_order: 2,
      });

      for (let i = 0; i < extrasList.length; i++) {
        const ext = extrasList[i];
        const optId = `${prod.id}_extra_${ext.id}`;
        await db.collection('options').doc(optId).set({
          id: optId,
          group_id: `${prod.id}_extras`,
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
        });
      }
    }
  }

  console.log(`Seeded ${rawProducts.length} products with option groups and options successfully!`);
}

seedEmulator().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
