"use server";
import pool from "../app/lib/db";  // ✅ Path fix
import { revalidatePath } from "next/cache";
import { ProductCategory } from "../app/lib/types";  // ✅ Path fix

const VALID_CATEGORIES = Object.values(ProductCategory);

export async function createProduct(formData: FormData) {
  try {
    const title = formData.get("title") as string;
    const originalPrice = formData.get("originalPrice") as string;
    const discountPrice = formData.get("discountPrice") as string;
    const description = formData.get("description") as string;
    const quantity = formData.get("quantity") as string;
    const categoriesRaw = formData.get("categories") as string;
    const images = formData.getAll("images") as File[];

    let categories: ProductCategory[] = [];
    try { categories = JSON.parse(categoriesRaw); } 
    catch { return { error: "Invalid categories format" }; }

    if (!title || !originalPrice || !description || !quantity || categories.length === 0) {
      return { error: "Title, Price, Description, Quantity and Category required" };
    }
    for (const cat of categories) {
      if (!VALID_CATEGORIES.includes(cat)) return { error: `Invalid category: ${cat}` };
    }
    if (images.length === 0 || images.length > 7) {
      return { error: images.length === 0 ? "At least one image required" : "Max 7 images" };
    }

    const base64Images: string[] = [];
    for (const file of images) {
      if (file.size === 0) continue;
      if (file.size > 5 * 1024 * 1024) return { error: `${file.name} >5MB` };
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      base64Images.push(`data:${file.type};base64,${base64}`);
    }

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO products (title, original_price, discount_price, description, images, quantity, categories)
         VALUES ($1, $2, $3, $4, $5, $6, $7::product_category[])`,
        [
          title, parseFloat(originalPrice),
          discountPrice ? parseFloat(discountPrice) : null,
          description, JSON.stringify(base64Images),
          parseInt(quantity) || 0,
          categories,  // ✅ Direct array
        ]
      );
    } finally { client.release(); }
    
    revalidatePath("/");
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { error: e.message || "Failed" };
  }
}

export async function updateProduct(formData: FormData) {
  try {
    const id = formData.get("id") as string;
    const title = formData.get("title") as string;
    const originalPrice = formData.get("originalPrice") as string;
    const discountPrice = formData.get("discountPrice") as string;
    const description = formData.get("description") as string;
    const quantity = formData.get("quantity") as string;
    const categoriesRaw = formData.get("categories") as string;
    const images = formData.getAll("images") as File[];

    let categories: ProductCategory[] = [];
    try { categories = JSON.parse(categoriesRaw); } 
    catch { return { error: "Invalid categories" }; }

    if (!id || !title || !originalPrice || !description || !quantity || categories.length === 0) {
      return { error: "Required fields missing" };
    }
    for (const cat of categories) {
      if (!VALID_CATEGORIES.includes(cat)) return { error: `Invalid: ${cat}` };
    }

    const base64Images: string[] = [];
    for (const file of images) {
      if (file.size === 0) continue;
      if (file.size > 5 * 1024 * 1024) return { error: `${file.name} >5MB` };
      const bytes = await file.arrayBuffer();
      base64Images.push(`data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`);
    }

    const client = await pool.connect();
    try {
      let finalImages: string[] = base64Images;
      if (base64Images.length === 0) {
        const existing = await client.query("SELECT images FROM products WHERE id = $1", [id]);
        const imgs = existing.rows[0]?.images;
        finalImages = Array.isArray(imgs) ? imgs : JSON.parse(imgs || "[]");
      }

      await client.query(
        `UPDATE products 
         SET title=$1, original_price=$2, discount_price=$3, description=$4, 
             images=$5, quantity=$6, categories=$7::product_category[] WHERE id=$8`,
        [
          title, parseFloat(originalPrice),
          discountPrice ? parseFloat(discountPrice) : null,
          description, JSON.stringify(finalImages),
          parseInt(quantity) || 0,
          categories,  // ✅ Direct array
          id
        ]
      );
    } finally { client.release(); }
    
    revalidatePath("/");
    return { success: true };
  } catch (e: any) {
    console.error(e);
    return { error: e.message || "Update failed" };
  }
}

export async function deleteProduct(id: number) {
  try {
    const client = await pool.connect();
    await client.query("DELETE FROM products WHERE id = $1", [id]);
    client.release();
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Delete failed" };
  }
}