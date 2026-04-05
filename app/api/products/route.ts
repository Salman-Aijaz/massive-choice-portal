// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/db';
import { ProductCategory } from '../../lib/types';

const VALID_CATEGORIES = Object.values(ProductCategory);

// ✅ Helper: Parse PostgreSQL array string to JS array
const parsePgArray = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // PostgreSQL array format: "{MEN,WOMEN}" or {"MEN","WOMEN"}
    if (value.startsWith('{') && value.endsWith('}')) {
      return value
        .slice(1, -1) // Remove { }
        .split(',')
        .map(item => item.replace(/^"|"$/g, '')) // Remove quotes if any
        .filter(Boolean);
    }
    return [value];
  }
  return [];
};

// POST - Create Product
export async function POST(req: NextRequest) {
  let client;
  try {
    const formData = await req.formData();
    const title = formData.get('title') as string;
    const originalPrice = formData.get('originalPrice') as string;
    const discountPrice = formData.get('discountPrice') as string;
    const description = formData.get('description') as string;
    const quantity = formData.get('quantity') as string;
    const categoriesRaw = formData.get('categories') as string;

    if (!title || !originalPrice || !description || !quantity || !categoriesRaw) {
      return NextResponse.json(
        { error: 'Title, Price, Description, Quantity and Categories are required' },
        { status: 400 }
      );
    }

    let categories: ProductCategory[] = [];
    try { categories = JSON.parse(categoriesRaw); }
    catch { return NextResponse.json({ error: 'Invalid categories format' }, { status: 400 }); }

    if (categories.length === 0) {
      return NextResponse.json({ error: 'At least one category required' }, { status: 400 });
    }
    for (const cat of categories) {
      if (!VALID_CATEGORIES.includes(cat)) {
        return NextResponse.json({ error: `Invalid category: ${cat}` }, { status: 400 });
      }
    }

    const imageFiles = formData.getAll('images') as File[];
    if (imageFiles.length === 0 || imageFiles.length > 7) {
      return NextResponse.json(
        { error: imageFiles.length === 0 ? 'At least one image required' : 'Max 7 images' },
        { status: 400 }
      );
    }

    const base64Images: string[] = [];
    for (const file of imageFiles) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: `${file.name} >5MB` }, { status: 400 });
      }
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      base64Images.push(`${file.type};base64,${base64}`);
    }

    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO products (title, original_price, discount_price, description, images, quantity, categories)
       VALUES ($1, $2, $3, $4, $5, $6, $7::product_category[])
       RETURNING *`,
      [
        title,
        parseFloat(originalPrice),
        discountPrice ? parseFloat(discountPrice) : null,
        description,
        JSON.stringify(base64Images),
        parseInt(quantity) || 0,
        categories,
      ]
    );
    client.release();

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// ✅ GET - Fetch All Products (FIXED: Double Release Removed)
export async function GET() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT id, title, original_price, discount_price, description, 
             images, quantity, categories, created_at 
      FROM products ORDER BY created_at DESC
    `);
    
    // ❌ client.release() yahan se HATA DIYA
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error: any) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (client) client.release(); // ✅ Sirf yahan rahega
  }
}

// ✅ PUT - Update Product (updated_at removed)
export async function PUT(req: NextRequest) {
  let client;
  try {
    const formData = await req.formData();
    const id = formData.get('id') as string;
    if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });

    const title = formData.get('title') as string;
    const originalPrice = formData.get('originalPrice') as string;
    const discountPrice = formData.get('discountPrice') as string;
    const description = formData.get('description') as string;
    const quantity = formData.get('quantity') as string;
    const categoriesRaw = formData.get('categories') as string;

    if (!title || !originalPrice || !description || !quantity || !categoriesRaw) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
    }

    let categories: ProductCategory[] = [];
    try { categories = JSON.parse(categoriesRaw); }
    catch { return NextResponse.json({ error: 'Invalid categories' }, { status: 400 }); }

    for (const cat of categories) {
      if (!VALID_CATEGORIES.includes(cat)) {
        return NextResponse.json({ error: `Invalid: ${cat}` }, { status: 400 });
      }
    }

    const imageFiles = formData.getAll('images') as File[];
    let base64Images: string[] = [];
    for (const file of imageFiles) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: `${file.name} >5MB` }, { status: 400 });
      }
      const buffer = await file.arrayBuffer();
      base64Images.push(`${file.type};base64,${Buffer.from(buffer).toString('base64')}`);
    }

    client = await pool.connect();
    
    let finalImages: string[] = base64Images;
    if (base64Images.length === 0) {
      const existing = await client.query('SELECT images FROM products WHERE id = $1', [id]);
      const imgs = existing.rows[0]?.images;
      if (typeof imgs === 'string') {
        try { finalImages = JSON.parse(imgs); } catch {}
      } else if (Array.isArray(imgs)) {
        finalImages = imgs;
      }
    }

    // ✅ UPDATED_AT YAHAN SE HATA DIYA
    const result = await client.query(
      `UPDATE products 
       SET title = $1, original_price = $2, discount_price = $3,
           description = $4, images = $5, quantity = $6, 
           categories = $7::product_category[]
       WHERE id = $8
       RETURNING *`,
      [
        title,
        parseFloat(originalPrice),
        discountPrice ? parseFloat(discountPrice) : null,
        description,
        JSON.stringify(finalImages),
        parseInt(quantity) || 0,
        categories,
        id,
      ]
    );
    client.release();

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error: any) {
    console.error('PUT Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// DELETE - Remove Product
export async function DELETE(req: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });

    client = await pool.connect();
    await client.query('DELETE FROM products WHERE id = $1', [id]);
    client.release();
    
    return NextResponse.json({ message: 'Deleted' }, { status: 200 });
  } catch (error: any) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}