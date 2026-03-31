"use server";

import pool from "../app/lib/db";
import { revalidatePath } from "next/cache";

// 🔥 Helper: Safe JSON parse for specifications
const safeJsonParse = (value: string | null) => {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

export async function createProduct(formData: FormData) {
  try {
    const title = formData.get("title") as string;
    const originalPrice = formData.get("originalPrice") as string;
    const discountPrice = formData.get("discountPrice") as string;
    const description = formData.get("description") as string;
    const specifications = formData.get("specifications") as string;
    const images = formData.getAll("images") as File[];
    const quantity = formData.get("quantity") as string;

    // Validation
    if (!title || !originalPrice || !description || !quantity) {
      return { error: "Title, Price, Description and Quantity are required" };
    }
    if (images.length === 0) {
      return { error: "At least one image is required" };
    }
    if (images.length > 7) {
      return { error: "Maximum 7 images allowed" };
    }

    // Images → base64 WITH data: prefix ✅
    const base64Images: string[] = [];
    for (const file of images) {
      if (file.size === 0) continue;
      if (file.size > 5 * 1024 * 1024) {
        return { error: `${file.name} 5MB se bada hai` };
      }
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      // ✅ FIXED: Added "data:" prefix
      base64Images.push(`data:${file.type};base64,${base64}`);
    }

    const client = await pool.connect();
    await client.query(
      `INSERT INTO products (title, original_price, discount_price, description, images, specifications, quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        title,
        parseFloat(originalPrice),
        discountPrice ? parseFloat(discountPrice) : null,
        description,
        JSON.stringify(base64Images),
        safeJsonParse(specifications),
        parseInt(quantity) || 0,
      ]
    );
    client.release();

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Server Action Error:", error);
    return { error: error.message || "Failed to create product" };
  }
}

export async function deleteProduct(id: number) {
  try {
    const client = await pool.connect();
    await client.query("DELETE FROM products WHERE id = $1", [id]);
    client.release();
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Failed to delete product" };
  }
}

export async function updateProduct(formData: FormData) {
  "use server";

  try {
    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const originalPrice = formData.get("originalPrice") as string;
    const discountPrice = formData.get("discountPrice") as string;
    const description = formData.get("description") as string;
    const specifications = formData.get("specifications") as string;
    const quantity = formData.get("quantity") as string;
    const images = formData.getAll("images") as File[];

    if (!id || !title || !originalPrice || !description || !quantity) {
      return { error: "Required fields missing" };
    }

    // Images → base64 WITH data: prefix ✅
    const base64Images: string[] = [];
    for (const file of images) {
      if (file.size === 0) continue;
      if (file.size > 5 * 1024 * 1024) {
        return { error: `${file.name} 5MB se bada hai` };
      }
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      // ✅ FIXED: Added "data:" prefix (ye missing tha!)
      base64Images.push(`data:${file.type};base64,${base64}`);
    }

    const client = await pool.connect();

    // 🔥 jsonb safe handling - existing images fetch
    const existing = await client.query("SELECT images FROM products WHERE id = $1", [id]);
    const imagesData = existing.rows[0]?.images;
    
    // jsonb already returns array, no need to parse
    const existingImages: string[] = Array.isArray(imagesData) ? imagesData : [];
    
    // Agar naye images hain toh unhe use karo, warna purane
    const finalImages = base64Images.length > 0 ? base64Images : existingImages;

    await client.query(
      `UPDATE products 
       SET title = $1, original_price = $2, discount_price = $3, 
           description = $4, images = $5, specifications = $6, 
           quantity = $7
       WHERE id = $8`,
      [
        title,
        parseFloat(originalPrice),
        discountPrice ? parseFloat(discountPrice) : null,
        description,
        JSON.stringify(finalImages), // ✅ Always stringify for jsonb
        safeJsonParse(specifications), // ✅ Safe parse
        parseInt(quantity) || 0,
        id,
      ]
    );

    client.release();
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Update Action Error:", error);
    return { error: error.message || "Failed to update product" };
  }
}