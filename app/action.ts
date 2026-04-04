// app/action.ts
"use server";
import pool from "../app/lib/db";
import { revalidatePath } from "next/cache";

const safeJsonParse = (value: string | null) => {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

// ✅ Category options for validation
const VALID_CATEGORIES = ['MEN', 'WOMEN', 'KIDS', 'COUPLE', 'SMART_WATCHES', 'CLASSIC', 'SPORT', 'LUXURY'];

export async function createProduct(formData: FormData) {
  try {
    const title = formData.get("title") as string;
    const originalPrice = formData.get("originalPrice") as string;
    const discountPrice = formData.get("discountPrice") as string;
    const description = formData.get("description") as string;
    const specifications = formData.get("specifications") as string;
    const quantity = formData.get("quantity") as string;
    const category = formData.get("category") as string; // ✅ NEW
    const images = formData.getAll("images") as File[];

    if (!title || !originalPrice || !description || !quantity || !category) {
      return { error: "Title, Price, Description, Quantity and Category are required" };
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return { error: "Invalid category selected" };
    }
    if (images.length === 0 || images.length > 7) {
      return { error: images.length === 0 ? "At least one image required" : "Max 7 images allowed" };
    }

    const base64Images: string[] = [];
    for (const file of images) {
      if (file.size === 0) continue;
      if (file.size > 5 * 1024 * 1024) return { error: `${file.name} 5MB se bada hai` };
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      base64Images.push(`data:${file.type};base64,${base64}`);
    }

    const client = await pool.connect();
    await client.query(
      `INSERT INTO products (title, original_price, discount_price, description, images, specifications, quantity, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::product_category)`,
      [
        title,
        parseFloat(originalPrice),
        discountPrice ? parseFloat(discountPrice) : null,
        description,
        JSON.stringify(base64Images),
        safeJsonParse(specifications),
        parseInt(quantity) || 0,
        category,
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
    const category = formData.get("category") as string; // ✅ NEW
    const images = formData.getAll("images") as File[];

    if (!id || !title || !originalPrice || !description || !quantity || !category) {
      return { error: "Required fields missing" };
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return { error: "Invalid category selected" };
    }

    const base64Images: string[] = [];
    for (const file of images) {
      if (file.size === 0) continue;
      if (file.size > 5 * 1024 * 1024) return { error: `${file.name} 5MB se bada hai` };
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      base64Images.push(`data:${file.type};base64,${base64}`);
    }

    const client = await pool.connect();
    const existing = await client.query("SELECT images FROM products WHERE id = $1", [id]);
    const imagesData = existing.rows[0]?.images;
    const existingImages: string[] = Array.isArray(imagesData) ? imagesData : [];
    const finalImages = base64Images.length > 0 ? base64Images : existingImages;

    await client.query(
      `UPDATE products 
       SET title = $1, original_price = $2, discount_price = $3, 
           description = $4, images = $5, specifications = $6, 
           quantity = $7, category = $8::product_category
       WHERE id = $9`,
      [
        title,
        parseFloat(originalPrice),
        discountPrice ? parseFloat(discountPrice) : null,
        description,
        JSON.stringify(finalImages),
        safeJsonParse(specifications),
        parseInt(quantity) || 0,
        category,
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