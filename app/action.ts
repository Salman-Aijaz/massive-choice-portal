'use server';

import pool from '../app/lib/db';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function createProduct(formData: FormData) {
  try {
    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    await mkdir(uploadDir, { recursive: true });

    // Extract fields
    const title = formData.get('title') as string;
    const originalPrice = formData.get('originalPrice') as string;
    const discountPrice = formData.get('discountPrice') as string;
    const description = formData.get('description') as string;
    const specifications = formData.get('specifications') as string;
    
    // Get all image files
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

    // Save images and collect URLs
    const imageUrls: string[] = [];
    for (const file of images) {
      if (file.size === 0) continue;
      
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = path.join(uploadDir, fileName);
      
      await writeFile(filePath, buffer);
      imageUrls.push(`/uploads/${fileName}`);
    }

    // Insert into database
    const client = await pool.connect();
    
    const query = `
      INSERT INTO products (title, original_price, discount_price, description, images, specifications)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    
    const values = [
      title,
      parseFloat(originalPrice),
      discountPrice ? parseFloat(discountPrice) : null,
      description,
      JSON.stringify(imageUrls),
      specifications ? JSON.parse(specifications) : null
    ];

    await client.query(query, values);
    client.release();

    // Revalidate cache so new product shows up immediately
    revalidatePath('/');
    
    return { success: true, message: 'Product added successfully!' };
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