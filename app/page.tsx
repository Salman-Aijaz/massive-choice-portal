"use client";
import { useState, useEffect, useRef, useTransition } from "react";
import { createProduct, deleteProduct, updateProduct } from "../app/action";

// 🔥 Helper: jsonb (array) ya text (string) dono handle karega
const getImagesArray = (images: any): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [images];
    } catch {
      return [images];
    }
  }
  return [];
};

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    originalPrice: "",
    discountPrice: "",
    description: "",
    specifications: "",
    quantity: "",
  });

  const fetchProducts = async () => {
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (files.length > 7) {
      alert("Maximum 7 images allowed!");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setImagePreviews([]);
      return;
    }
    const previews = Array.from(files).map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const removePreview = (index: number) => {
    const newPreviews = [...imagePreviews];
    newPreviews.splice(index, 1);
    setImagePreviews(newPreviews);
    if (fileInputRef.current?.files) {
      const dt = new DataTransfer();
      const files = fileInputRef.current.files;
      for (let i = 0; i < files.length; i++) {
        if (i !== index) dt.items.add(files[i]);
      }
      fileInputRef.current.files = dt.files;
    }
  };

  // ✏️ Edit Handler - FIXED for jsonb
  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setIsEditing(true);
    setFormData({
      title: product.title,
      originalPrice: product.original_price?.toString() || "",
      discountPrice: product.discount_price?.toString() || "",
      description: product.description,
      specifications: product.specifications
        ? JSON.stringify(product.specifications, null, 2)
        : "",
      quantity: product.quantity?.toString() || "0",
    });

    // ✅ Safe images handling for jsonb
    const imgs = getImagesArray(product.images);
    setImagePreviews(imgs.slice(0, 7));

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ❌ Cancel Edit
  const cancelEdit = () => {
    setEditingId(null);
    setIsEditing(false);
    setFormData({
      title: "",
      originalPrice: "",
      discountPrice: "",
      description: "",
      specifications: "",
      quantity: "",
    });
    setImagePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = new FormData();

    if (isEditing && editingId) {
      form.append("id", editingId.toString());
    }

    form.append("title", formData.title);
    form.append("originalPrice", formData.originalPrice);
    form.append("discountPrice", formData.discountPrice);
    form.append("description", formData.description);
    form.append("quantity", formData.quantity);

    if (formData.specifications.trim() !== "") {
      form.append("specifications", formData.specifications);
    }

    const files = fileInputRef.current?.files;

    if (!isEditing && (!files || files.length === 0)) {
      alert("At least one image is required!");
      return;
    }

    for (const file of files || []) {
      form.append("images", file);
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateProduct(form)
        : await createProduct(form);

      if (result?.error) {
        alert(`❌ ${result.error}`);
      } else if (result?.success) {
        alert(isEditing ? "✅ Product updated!" : "✅ Product added!");
        setFormData({
          title: "",
          originalPrice: "",
          discountPrice: "",
          description: "",
          specifications: "",
          quantity: "",
        });
        setImagePreviews([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setEditingId(null);
        setIsEditing(false);
        fetchProducts();
      }
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this product?")) return;
    const result = await deleteProduct(id);
    if (result?.success) {
      alert("Product deleted!");
      fetchProducts();
    } else {
      alert("Failed to delete");
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center text-gray-800">
        🛍️ Massive Choice CMS
      </h1>

      <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg mb-8 max-w-2xl mx-auto border border-gray-200">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">
          {isEditing ? "✏️ Edit Product" : "➕ Add New Product"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isEditing && (
            <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4">
              <span className="text-yellow-800 text-sm font-medium">
                Editing Product ID: {editingId}
              </span>
              <button
                type="button"
                onClick={cancelEdit}
                className="text-sm text-gray-600 hover:text-gray-900 underline font-medium"
              >
                Cancel Edit
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Title *
            </label>
            <input
              type="text"
              placeholder="Product title..."
              required
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          {/* Prices + Quantity */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Original Price (PKR) *
              </label>
              <input
                type="number"
                placeholder="9500"
                required
                min="0"
                step="0.01"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                value={formData.originalPrice}
                onChange={(e) =>
                  setFormData({ ...formData, originalPrice: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Discount Price (PKR)
              </label>
              <input
                type="number"
                placeholder="5700"
                min="0"
                step="0.01"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                value={formData.discountPrice}
                onChange={(e) =>
                  setFormData({ ...formData, discountPrice: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Quantity (Pieces) *
              </label>
              <input
                type="number"
                placeholder="50"
                required
                min="0"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Description *
            </label>
            <textarea
              placeholder="Product description..."
              required
              rows={3}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-vertical text-black"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Product Images {isEditing ? "(Optional)" : "*"} (Min 1, Max 7)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="w-full p-2 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer text-black"
            />
          </div>

          {/* Previews */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {imagePreviews.map((src, index) => (
                <div key={index} className="relative group">
                  <img
                    src={src}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-16 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => removePreview(index)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Specifications */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Specifications{" "}
              <span className="text-gray-400 font-normal">
                (Optional - JSON)
              </span>
            </label>
            <textarea
              placeholder={`{ "gender": "Men", "warranty": "1 Year" }`}
              rows={4}
              className="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-vertical text-black"
              value={formData.specifications}
              onChange={(e) =>
                setFormData({ ...formData, specifications: e.target.value })
              }
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || (!isEditing && imagePreviews.length === 0)}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                {isEditing ? "Updating..." : "Uploading..."}
              </>
            ) : isEditing ? (
              "💾 Update Product"
            ) : (
              "🚀 Add Product"
            )}
          </button>
        </form>
      </div>

      {/* Product List */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">
          📦 Products ({products.length})
        </h2>
        {products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">
              No products yet. Add your first product! 🎉
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => {
              // ✅ Safe images array for each product
              const images = getImagesArray(product.images);
              const firstImage = images[0] || "/placeholder.png";
              const imagesCount = images.length;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition"
                >
                  <div className="relative">
                    <img
                      src={firstImage}
                      alt={product.title}
                      className="w-full h-48 object-cover"
                    />

                    {/* Action Buttons */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <button
                        onClick={() => handleEdit(product)}
                        className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-blue-600 transition"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600 transition"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Image Count Badge */}
                    {imagesCount > 1 && (
                      <span className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                        +{imagesCount - 1}
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 line-clamp-2">
                      {product.title}
                    </h3>

                    {/* Price */}
                    <div className="flex items-center gap-2 my-2">
                      <span className="text-gray-400 line-through text-sm">
                        PKR {product.original_price}
                      </span>
                      {product.discount_price && (
                        <span className="text-red-600 font-bold">
                          PKR {product.discount_price}
                        </span>
                      )}
                    </div>

                    {/* Quantity Badge */}
                    <div className="mb-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          product.quantity > 10
                            ? "bg-green-100 text-green-800"
                            : product.quantity > 0
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {product.quantity > 0
                          ? `📦 ${product.quantity} in stock`
                          : "❌ Out of Stock"}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {product.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}