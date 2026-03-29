'use client';
import { useState, useEffect, useRef, useTransition } from 'react';
import { createProduct, deleteProduct } from '../app/action';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition(); // For server action loading state
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    originalPrice: '',
    discountPrice: '',
    description: '',
    specifications: ''
  });

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
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
      alert('Maximum 7 images allowed!');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setImagePreviews([]);
      return;
    }
    const previews = Array.from(files).map(file => URL.createObjectURL(file));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const form = new FormData();
    form.append('title', formData.title);
    form.append('originalPrice', formData.originalPrice);
    form.append('discountPrice', formData.discountPrice);
    form.append('description', formData.description);
    
    if (formData.specifications.trim() !== '') {
      form.append('specifications', formData.specifications);
    }

    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      alert('At least one image is required!');
      return;
    }
    for (const file of files) {
      form.append('images', file);
    }

    startTransition(async () => {
      const result = await createProduct(form);
      
      if (result?.error) {
        alert(`❌ ${result.error}`);
      } else if (result?.success) {
        alert('✅ Product added!');
        setFormData({ title: '', originalPrice: '', discountPrice: '', description: '', specifications: '' });
        setImagePreviews([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchProducts();
      }
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    const result = await deleteProduct(id);
    if (result?.success) {
      alert('Product deleted!');
      fetchProducts();
    } else {
      alert('Failed to delete');
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-center text-gray-800">
        🛍️ Massive Choice CMS
      </h1>

      <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg mb-8 max-w-2xl mx-auto border border-gray-200">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">➕ Add New Product</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Title *</label>
            <input
              type="text"
              placeholder="Product title..."
              required
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Original Price (PKR) *</label>
              <input
                type="number"
                placeholder="9500"
                required
                min="0"
                step="0.01"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                value={formData.originalPrice}
                onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Discount Price (PKR)</label>
              <input
                type="number"
                placeholder="5700"
                min="0"
                step="0.01"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                value={formData.discountPrice}
                onChange={(e) => setFormData({ ...formData, discountPrice: e.target.value })}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Description *</label>
            <textarea
              placeholder="Product description..."
              required
              rows={3}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-vertical text-black"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Product Images * (Min 1, Max 7)
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
                  <img src={src} alt={`Preview ${index + 1}`} className="w-full h-16 object-cover rounded-lg border" />
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
              Specifications <span className="text-gray-400 font-normal">(Optional - JSON)</span>
            </label>
            <textarea
              placeholder={`{ "gender": "Men", "warranty": "1 Year" }`}
              rows={4}
              className="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-vertical text-black"
              value={formData.specifications}
              onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || imagePreviews.length === 0}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Uploading...
              </>
            ) : (
              '🚀 Add Product'
            )}
          </button>
        </form>
      </div>

      {/* Product List (same as before, just add handleDelete) */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">📦 Products ({products.length})</h2>
        {products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">No products yet. Add your first product! 🎉</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="relative">
                  <img src={product.images?.[0] || '/placeholder.png'} alt={product.title} className="w-full h-48 object-cover" />
                  {product.images?.length > 1 && (
                    <span className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                      +{product.images.length - 1}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="absolute top-2 left-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600"
                  >
                    🗑️
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 line-clamp-2">{product.title}</h3>
                  <div className="flex items-center gap-2 my-2">
                    <span className="text-gray-400 line-through text-sm">PKR {product.original_price}</span>
                    {product.discount_price && <span className="text-red-600 font-bold">PKR {product.discount_price}</span>}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}