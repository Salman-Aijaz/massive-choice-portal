import { NextRequest, NextResponse } from 'next/server';
import pool from '../../lib/db';

// POST API - FormData se images base64 mein convert karke DB mein save
export async function POST(req: NextRequest) {
  let client;

  try {
    const formData = await req.formData();

    const title = formData.get('title') as string;
    const originalPrice = formData.get('originalPrice') as string;
    const discountPrice = formData.get('discountPrice') as string;
    const description = formData.get('description') as string;
    const specifications = formData.get('specifications') as string;
    const quantity = formData.get('quantity') as string;

    // Validation
    if (!title || !originalPrice || !description || !quantity) {
      return NextResponse.json(
        { error: 'Title, Price, Description and Quantity are required' },
        { status: 400 }
      );
    }

    // Images base64 mein convert karo
    const imageFiles = formData.getAll('images') as File[];

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: 'At least one image is required' },
        { status: 400 }
      );
    }

    if (imageFiles.length > 7) {
      return NextResponse.json(
        { error: 'Maximum 7 images allowed' },
        { status: 400 }
      );
    }

    const base64Images: string[] = [];

    for (const file of imageFiles) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 5MB limit` },
          { status: 400 }
        );
      }
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = file.type;
      base64Images.push(`data:${mimeType};base64,${base64}`);
    }

    // DB insert
    client = await pool.connect();

    const query = `
      INSERT INTO products (title, original_price, discount_price, description, images, specifications, quantity)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      title,
      parseFloat(originalPrice),
      discountPrice ? parseFloat(discountPrice) : null,
      description,
      JSON.stringify(base64Images),
      specifications ? JSON.parse(specifications) : null,
      parseInt(quantity) || 0,
    ];

    const result = await client.query(query, values);
    return NextResponse.json(result.rows[0], { status: 201 });

  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload product' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

// GET API
export async function GET() {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT * FROM products ORDER BY created_at DESC'
    );
    client.release();
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// DELETE API
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    await client.query('DELETE FROM products WHERE id = $1', [id]);
    client.release();

    return NextResponse.json({ message: 'Product deleted' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to delete products' },
      { status: 500 }
    );
  }
}

// PUT API - Product Update
export async function PUT(req: NextRequest) {
  let client;
  
  try {
    const formData = await req.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const title = formData.get('title') as string;
    const originalPrice = formData.get('originalPrice') as string;
    const discountPrice = formData.get('discountPrice') as string;
    const description = formData.get('description') as string;
    const specifications = formData.get('specifications') as string;
    const quantity = formData.get('quantity') as string;

    // Validation
    if (!title || !originalPrice || !description || !quantity) {
      return NextResponse.json(
        { error: 'Title, Price, Quantity and Description are required' },
        { status: 400 }
      );
    }

    // Images handle karo (agar naye images upload hue hain)
    const imageFiles = formData.getAll('images') as File[];
    let base64Images: string[] = [];

    for (const file of imageFiles) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 5MB limit` },
          { status: 400 }
        );
      }
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = file.type;
      base64Images.push(`data:${mimeType};base64,${base64}`);
    }

    client = await pool.connect();

    // Pehle purana product fetch karo taaki existing images retain ho sake
    const existing = await client.query('SELECT images FROM products WHERE id = $1', [id]);
    const existingImages = existing.rows[0]?.images ? JSON.parse(existing.rows[0].images) : [];
    
    // Agar naye images hain toh unhe merge karo, warna purane hi rakh lo
    const finalImages = base64Images.length > 0 ? base64Images : existingImages;

    const query = `
      UPDATE products 
      SET title = $1, 
          original_price = $2, 
          discount_price = $3, 
          description = $4, 
          images = $5, 
          specifications = $6,
          quantity = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `;

    const values = [
      title,
      parseFloat(originalPrice),
      discountPrice ? parseFloat(discountPrice) : null,
      description,
      JSON.stringify(finalImages),
      specifications ? JSON.parse(specifications) : null,
      parseInt(quantity) || 0,
      id,
    ];

    const result = await client.query(query, values);
    return NextResponse.json(result.rows[0], { status: 200 });

  } catch (error: any) {
    console.error('Update Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update product' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}