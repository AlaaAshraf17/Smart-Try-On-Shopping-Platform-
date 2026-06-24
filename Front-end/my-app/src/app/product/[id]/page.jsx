'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Model3D from '@/components/ui/Model3D';
import WishlistHeart from '@/components/ui/WishlistHeart';
import { useGLTF } from '@react-three/drei';
import { API } from '@/lib/axios';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';

function StarRating({ rating, interactive = false, value = 0, onChange }) {
  const [hovered, setHovered] = useState(0);
  const display = interactive ? (hovered || value) : Math.round(rating);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={interactive ? 'button' : undefined}
          disabled={!interactive}
          onClick={() => interactive && onChange?.(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={interactive ? 'cursor-pointer' : 'cursor-default'}
        >
          <svg
            className={`w-5 h-5 transition-colors ${star <= display ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
            fill="currentColor" viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { toggleWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [qty, setQty] = useState(1);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectedColor, setSelectedColor] = useState(null);

  const availableColors = [
    '#000000',
    '#ffffff',
    '#ef4444',
    '#3b82f6',
    '#22c55e',
    '#f59e0b',
  ];

  const loadProduct = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/api/products/${id}`);
      setProduct(data);
      if (data.glbModel) useGLTF.preload(data.glbModel);
    } catch {
      router.push('/product');
    } finally {
      setLoading(false);
    }
  };




  useEffect(() => { if (id) loadProduct(); }, [id]);


  const handleAddToCart = async () => {
    if (!user) { router.push('/login'); return; }
    try {
      await addToCart(product, qty);
      toast.success('Added to cart!');
    } catch (err) {
      toast.error('Failed to add to cart.');
    }
  };

  const handleWishlist = async () => {
    if (!user) { 
      toast.error('Please login to save items.'); 
      return; 
    }
    try {
      await toggleWishlist(product._id);
      toast.success('Wishlist updated!');
    } catch (err) {
      toast.error('Failed to update wishlist.');
    }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    if (!reviewRating) { toast.error('Please select a rating.'); return; }
    setSubmitting(true);
    try {
      await API.post(`/api/products/${id}/reviews`, { rating: reviewRating, comment: reviewComment });
      toast.success('Review submitted!');
      setReviewRating(0);
      setReviewComment('');
      loadProduct();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-300 dark:border-slate-600 border-t-slate-900 dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) return null;

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'reviews', label: `Reviews (${product.numReviews})` },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300">

      {/* Breadcrumb */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/product" className="hover:text-slate-900 dark:hover:text-white transition-colors">Products</Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-white truncate max-w-[200px]">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <div className="grid md:grid-cols-2 gap-12 items-start">

          {/* 3D model or image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700"
          >
            {product.glbModel ? (
              <>
                <Model3D modelPath={product.glbModel} color={selectedColor} />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="px-4 py-2 text-xs font-medium tracking-wider text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-600 rounded-full">
                    Drag to rotate · Scroll to zoom
                  </span>
                </div>
              </>
            ) : (
              <Image src={product.image} alt={product.name} fill className="object-cover" sizes="50vw" priority />
            )}
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 text-[9px] uppercase tracking-[0.2em] font-semibold text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-full">
                  {product.category}
                </span>
                {product.subCategory && (
                  <span className="px-3 py-1 text-[9px] uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-full">
                    {product.subCategory}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{product.brand}</p>
              <h1 className="text-4xl md:text-5xl font-serif text-slate-900 dark:text-white leading-tight mb-3">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 mb-4">
                <StarRating rating={product.rating} />
                <span className="text-sm text-slate-400 dark:text-slate-500">{product.numReviews} review{product.numReviews !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-3xl font-medium text-slate-900 dark:text-white">{product.price} EGP</p>
            </div>

            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{product.description}</p>

            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${product.countInStock > 0 ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {product.countInStock > 0 ? `${product.countInStock} in stock` : 'Out of stock'}
              </span>
            </div>

            {product.countInStock > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Qty</span>
                  <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden">
                    <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">−</button>
                    <span className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-white border-x border-slate-300 dark:border-slate-600">{qty}</span>
                    <button onClick={() => setQty(q => Math.min(product.countInStock, q + 1))} className="px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">+</button>
                  </div>
                </div>
                <div className="flex gap-3">

                  {/* Try On button — Clothes only → forwards to Find My Fit */}
                  {product.category === 'Clothes' && (
                    <button
                      onClick={() => router.push('/find-my-fit')}
                      className="px-4 py-3.5 bg-blue-600 text-white rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      Try On 👕
                    </button>
                  )}

                  {/* Live camera try-on — navigates to /try-on/[id] room */}
                  {product.glbModel && product.category === 'Accessories' && (
                    <button
                      onClick={() => router.push(`/try-on/${product._id}`)}
                      className="flex items-center gap-2 px-4 py-3.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      {/* Camera icon */}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                      Try Live
                    </button>
                  )}

                  <button onClick={handleAddToCart} className="flex-1 py-3.5 text-sm font-medium tracking-widest uppercase bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all">
                    Add to Cart
                  </button>
                  <div className="px-4 py-3.5 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center">
                    <WishlistHeart productId={product._id} size="lg" />
                  </div>
                </div>

                {product.glbModel && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">Choose color</div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedColor(null)}
                        className={`px-4 py-2 rounded-full border transition ${selectedColor === null ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                      >
                        Original
                      </button>
                      {availableColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`w-10 h-10 rounded-full border-2 transition ${selectedColor === color ? 'border-slate-900 dark:border-white' : 'border-slate-200 dark:border-slate-700'}`}
                          style={{ backgroundColor: color }}
                          aria-label={`Select ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="mt-20">
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium tracking-wide transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'details' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-4">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{product.description}</p>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-sm text-slate-500 dark:text-slate-400">
                <p>Brand: <span className="text-slate-700 dark:text-slate-300">{product.brand}</span></p>
                {product.subCategory && <p>Sub-category: <span className="text-slate-700 dark:text-slate-300">{product.subCategory}</span></p>}
              </div>
            </motion.div>
          )}

          {activeTab === 'reviews' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 max-w-2xl">
              {product.reviews.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500">No reviews yet. Be the first!</p>
              ) : (
                <div className="space-y-6">
                  {product.reviews.map((r) => (
                    <div key={r._id} className="border-b border-slate-100 dark:border-slate-800 pb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-900 dark:text-white">{r.name}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <StarRating rating={r.rating} />
                      <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {user ? (
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
                  <h3 className="font-serif text-xl text-slate-900 dark:text-white mb-5">Write a Review</h3>
                  <form onSubmit={handleReview} className="space-y-4">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Rating</label>
                      <StarRating rating={reviewRating} interactive value={reviewRating} onChange={setReviewRating} />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Comment</label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={4}
                        required
                        placeholder="Share your thoughts..."
                        className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors resize-none"
                      />
                    </div>
                    <button type="submit" disabled={submitting} className="px-6 py-3 text-sm font-medium tracking-widest uppercase bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all">
                      {submitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <Link href="/login" className="text-slate-900 dark:text-white underline underline-offset-4">Login</Link> to write a review.
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
