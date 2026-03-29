'use server';

import pool from '../app/lib/db';
import { revalidatePath } from 'next/cache';

export async function createProduct(formData: FormData) {
  try {
    const title = formData.get('title') as string;
    const originalPrice = formData.get('originalPrice') as string;
    const discountPrice = formData.get('discountPrice') as string;
    const description = formData.get('description') as string;
    const specifications = formData.get('specifications') as string;
    const images = formData.getAll('images') as File[];

    // Validation
    if (!title || !originalPrice || !description) {
      return { error: 'Title, Price and Description are required' };
    }
    if (images.length === 0) {
      return { error: 'At least one image is required' };
    }
    if (images.length > 7) {
      return { error: 'Maximum 7 images allowed' };
    }

    // Images → base64
    const base64Images: string[] = [];
    for (const file of images) {
      if (file.size === 0) continue;
      if (file.size > 5 * 1024 * 1024) {
        return { error: `${file.name} 5MB se bada hai` };
      }
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      base64Images.push(`data:${file.type};base64,${base64}`);
    }

    // DB insert
    const client = await pool.connect();
    await client.query(
      `INSERT INTO products (title, original_price, discount_price, description, images, specifications)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        title,
        parseFloat(originalPrice),
        discountPrice ? parseFloat(discountPrice) : null,
        description,
        JSON.stringify(base64Images),
        specifications ? JSON.parse(specifications) : null,
      ]
    );
    client.release();

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error:', error);
    return { error: error.message || 'Failed to create product' };
  }
}

export async function deleteProduct(id: number) {
  try {
    const client = await pool.connect();
    await client.query('DELETE FROM products WHERE id = $1', [id]);
    client.release();
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Failed to delete product' };
  }
}