'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Model3D from '@/components/ui/Model3D';
import WishlistHeart from '@/components/ui/WishlistHeart';
import { useGLTF } from '@react-three/drei';
import Image from 'next/image';
import Link from 'next/link';
import { API } from '@/lib/axios';

const CATEGORIES = ['All', 'Clothes', 'Accessories', 'Bags'];

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`w-3.5 h-3.5 ${star <= Math.round(rating) ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}


function ProductViewer({ product }) {
  if (product.glbModel) {
    return <Model3D modelPath={product.glbModel} />;
  }
  return (
    <Image
      src={product.image}
      alt={product.name}
      fill
      className="object-cover"
      sizes="50vw"
    />
  );
}

function ProductCardImage({ product }) {
  return (
    <Image
      src={product.image}
      alt={product.name}
      fill
      className="object-cover group-hover:scale-105 transition-transform duration-500"
      sizes="(max-width: 768px) 100vw, 25vw"
    />
  );
}

export default function Products() {
  const [allProducts, setAllProducts] = useState([]); // full unfiltered list across all pages
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeCategory, setActiveCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Fetch ALL products once on mount so category filtering always has the full dataset.
  // The API paginates to 8 per page, so we loop through all pages.
  useEffect(() => {
    const loadAllProducts = async () => {
      setLoading(true);
      try {
        // First request to find out total pages
        const { data: first } = await API.get('/api/products?pageNumber=1&pageSize=8');
        const totalPages = first.pages || 1;
        let all = [...(first.products || [])];

        // Fetch remaining pages in parallel
        if (totalPages > 1) {
          const requests = [];
          for (let p = 2; p <= totalPages; p++) {
            requests.push(API.get(`/api/products?pageNumber=${p}&pageSize=8`));
          }
          const results = await Promise.all(requests);
          results.forEach(({ data }) => {
            all = all.concat(data.products || []);
          });
        }

        setAllProducts(all);
        if (all[0]?.glbModel) useGLTF.preload(all[0].glbModel);
      } catch (e) {
        console.error('Failed to fetch products:', e);
        setAllProducts([]);
        setError(e.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    loadAllProducts();
  }, []);

  const PAGE_SIZE = 8;

  // Filter all products by active category
  const filtered = activeCategory === 'All'
    ? allProducts
    : allProducts.filter(p => p.category === activeCategory);

  // Client-side pagination of the filtered list
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const products   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selected = products[selectedIdx] || products[0] || allProducts[0];

  const handleSelect = (index) => {
    setSelectedIdx(index);
    const model = filtered[index]?.glbModel;
    if (model) useGLTF.preload(model);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 border-2 border-slate-300 dark:border-slate-600 border-t-slate-900 dark:border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading products...</p>
        </div>
      </div>
    );
  }

  if (!allProducts.length) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
        <p className="text-slate-400 dark:text-slate-500">No products found.</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300">

      {/* Hero */}
      <section className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
            <span className="inline-block px-4 py-1.5 text-xs font-medium tracking-wider text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-full">
              3D Product Viewer
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-slate-900 dark:text-white">
              Explore Our Collection
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Experience products in 3D. Rotate, zoom, and explore every detail before you buy.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured viewer */}
      {selected && (
        <section className="bg-white dark:bg-slate-900 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">

              <motion.div
                key={`main-${selected._id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="relative bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
                style={{ aspectRatio: '1/1' }}
              >
                <ProductViewer product={selected} />
                {selected.glbModel && (
                  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
                    <span className="inline-block px-4 py-2 text-xs font-medium tracking-wider text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-600 rounded-full">
                      Drag to rotate • Scroll to zoom
                    </span>
                  </div>
                )}
              </motion.div>

              <motion.div
                key={`info-${selected._id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-8"
              >
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-[0.3em] font-semibold text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-full">
                      {selected.category}
                    </span>
                    {selected.subCategory && (
                      <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-[0.3em] font-semibold text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-full">
                        {selected.subCategory}
                      </span>
                    )}
                  </div>
                  <h2 className="text-4xl md:text-5xl font-serif text-slate-900 dark:text-white mb-2">
                    {selected.name}
                  </h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-4 uppercase tracking-widest">
                    {selected.brand}
                  </p>
                  <div className="flex items-center gap-3 mb-6">
                    <StarRating rating={selected.rating} />
                    <span className="text-sm text-slate-400 dark:text-slate-500">({selected.numReviews} reviews)</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-6">
                    {selected.description}
                  </p>
                  <p className="text-3xl font-medium text-slate-900 dark:text-white">
                    {selected.price} EGP
                  </p>
                </div>

                <div className="flex gap-4 pt-2">
                  <Link
                    href={`/product/${selected._id}`}
                    className="flex-1 px-8 py-3.5 text-sm font-medium tracking-wider text-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-200"
                  >
                    VIEW DETAILS
                  </Link>
                  <div className="px-5 py-3.5 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors duration-200 flex items-center justify-center">
                    <WishlistHeart productId={selected._id} size="lg" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* All products grid */}
      <section className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <h3 className="text-3xl md:text-4xl font-serif text-slate-900 dark:text-white mb-2">All Products</h3>
              <p className="text-slate-500 dark:text-slate-400">Click any product to view above</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSelectedIdx(0); setPage(1); }}
                  className={`px-4 py-1.5 text-xs font-medium tracking-wider rounded-full border transition-all duration-200 ${
                    activeCategory === cat
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                      : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-500 dark:hover:border-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filtered.map((product, index) => {
                const isSelected = selected?._id === product._id;
                return (
                  <motion.div
                    key={product._id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelect(index)}
                    className={`cursor-pointer group bg-white dark:bg-slate-900 border-2 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-slate-900 ${
                      isSelected
                        ? 'border-slate-900 dark:border-white shadow-lg'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="aspect-square relative bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900">
                      <ProductCardImage product={product} />
                      <div className="absolute top-3 right-3 z-20">
                        <WishlistHeart productId={product._id} size="md" />
                      </div>
                      {product.countInStock === 0 && (
                        <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 flex items-center justify-center">
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Out of Stock</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-block px-2 py-1 text-[9px] uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full">
                          {product.category}
                        </span>
                        <StarRating rating={product.rating} />
                      </div>
                      <h4 className="text-lg font-serif text-slate-900 dark:text-white mb-1 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                        {product.name}
                      </h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-widest">{product.brand}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-medium text-slate-900 dark:text-white">{product.price} EGP</p>
                        <Link
                          href={`/product/${product._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          Details →
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-16">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 text-sm rounded-xl border transition-colors ${
                    p === safePage
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                      : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >{p}</button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >Next →</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
