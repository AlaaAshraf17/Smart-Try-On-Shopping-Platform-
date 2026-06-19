'use client';

/**
 * /try-on/[id]  — Live Camera Try-On Room
 *
 * This page is opened when the user clicks "Try Live" on a product detail page.
 * It fetches the product by ID, then renders TryOnCamera fullscreen.
 *
 * URL params:
 *   id — the product MongoDB _id (same as /product/[id])
 *
 * Query params passed from the product page:
 *   None — we fetch the product fresh here so this page is self-contained
 *   and can be bookmarked or shared.
 *
 * Flow:
 *   1. Fetch product from /api/products/:id
 *   2. If product has no glbModel → show "not supported" message
 *   3. Otherwise render TryOnCamera with glbModel + category
 *   4. onClose → router.back() to return to the product page
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TryOnCamera from '@/components/ui/TryOnCamera';
import { API } from '@/lib/axios';

export default function TryOnRoomPage() {
  const { id }   = useParams();
  const router   = useRouter();

  const [product,  setProduct]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // ── Fetch the product ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      try {
        const { data } = await API.get(`/api/products/${id}`);
        setProduct(data);
      } catch (err) {
        setError('Product not found.');
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !product) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-white/60 text-sm">{error || 'Something went wrong.'}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Only Accessories (glasses) are supported by the AI tracker.
  const supported = product.category === 'Accessories';

  if (!product.glbModel || !supported) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-2">
          {/* Camera icon */}
          <svg className="w-7 h-7 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <p className="text-white font-medium text-sm">Live Try-On Not Available</p>
          <p className="text-white/40 text-xs max-w-xs">
            {!product.glbModel
              ? 'This product does not have a 3D model yet.'
              : 'Live try-on is currently supported for Accessories (glasses) only.'}
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="mt-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-colors"
        >
          Back to Product
        </button>
      </div>
    );
  }

  // ── Render the camera try-on room ──────────────────────────────────────────
  return (
    <TryOnCamera
      glbModel={product.glbModel}
      onClose={() => router.back()}
    />
  );
}
