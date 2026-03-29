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

    // Validation
    if (!title || !originalPrice || !description) {
      return NextResponse.json(
        { error: 'Title, Price and Description are required' },
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
      INSERT INTO products (title, original_price, discount_price, description, images, specifications)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      title,
      parseFloat(originalPrice),
      discountPrice ? parseFloat(discountPrice) : null,
      description,
      JSON.stringify(base64Images),
      specifications ? JSON.parse(specifications) : null,
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