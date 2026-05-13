'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useWishlist } from '@/contexts/WishlistContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { API } from '@/lib/axios'
import WishlistHeart from '@/components/ui/WishlistHeart'

const tabs = ['Account', 'Measurements', 'Orders', 'Wishlist']

const PAYMENT_LABELS = { cash: 'Cash on Delivery', card: 'Card', paypal: 'PayPal' }

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`w-3.5 h-3.5 ${star <= Math.round(rating) ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await API.get('/api/orders/myorders')
        setOrders(data)
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-base mb-4">No orders yet</p>
        <Link href="/product" className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-medium rounded-full hover:opacity-90 transition-all">
          Start Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map(order => (
        <div
          key={order._id}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden"
        >
          {/* Order header */}
          <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="space-y-0.5">
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">{order._id}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod} · {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${
                order.isPaid
                  ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
                  : 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
              }`}>
                {order.isPaid ? 'Paid' : 'Unpaid'}
              </span>
              <span className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${
                order.isDelivered
                  ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
                  : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'
              }`}>
                {order.isDelivered ? 'Delivered' : 'Pending'}
              </span>
            </div>
          </div>

          {/* Items */}
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {order.orderItems.map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill className="object-cover" sizes="56px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {item.qty} × {item.price} EGP
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white shrink-0">
                  {(item.qty * item.price).toFixed(2)} EGP
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Total: {Number(order.totalPrice).toFixed(2)} EGP
            </p>
            <Link
              href={`/order/${order._id}`}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
            >
              View details
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}

const ProfilePage = () => {
  const { user, logout } = useAuth()
  const { wishlistItems, loading: wishlistLoading } = useWishlist()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Account')
  const [measurements, setMeasurements] = useState({
    height: '', weight: '', chest: '', waist: '', hips: '', inseam: ''
  })
  const [saved, setSaved] = useState(false)

  React.useEffect(() => {
    if (!user) router.push('/login')
    const stored = localStorage.getItem('measurements')
    if (stored) setMeasurements(JSON.parse(stored))
  }, [user, router])

  if (!user) return null

  const handleSaveMeasurements = () => {
    localStorage.setItem('measurements', JSON.stringify(measurements))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <section className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-4 font-serif">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6"
        >
          <div className="shrink-0 w-24 h-24 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-4xl font-bold">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{user.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-base mt-1">{user.email}</p>
            {user.isAdmin && (
              <span className="inline-block mt-2 px-3 py-1 text-sm font-semibold tracking-widest uppercase border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-full">
                Admin
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-base font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors duration-200"
          >
            LOGOUT
          </button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-base font-medium rounded-lg transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-8"
        >

          {activeTab === 'Account' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Account Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Full Name', value: user.name },
                  { label: 'Email Address', value: user.email },
                  { label: 'Account Type', value: user.isAdmin ? 'Administrator' : 'Customer' },
                  { label: 'Member Since', value: '2026' },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                    <p className="text-slate-900 dark:text-white text-base">{value}</p>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex flex-wrap gap-3">
                <Link
                  href="/product"
                  className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-medium rounded-full hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors duration-200"
                >
                  Browse Products
                </Link>
                <Link
                  href="/try-on"
                  className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-base font-medium rounded-full hover:border-slate-900 dark:hover:border-white hover:text-slate-900 dark:hover:text-white transition-colors duration-200"
                >
                  Virtual Try-On
                </Link>
              </div>
            </div>
          )}

          {activeTab === 'Measurements' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Body Measurements</h2>
                <p className="text-base text-slate-500 dark:text-slate-400 mt-1">
                  Save your measurements for a more accurate virtual try-on experience.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { key: 'height', label: 'Height', unit: 'cm' },
                  { key: 'weight', label: 'Weight', unit: 'kg' },
                  { key: 'chest', label: 'Chest', unit: 'cm' },
                  { key: 'waist', label: 'Waist', unit: 'cm' },
                  { key: 'hips', label: 'Hips', unit: 'cm' },
                  { key: 'inseam', label: 'Inseam', unit: 'cm' },
                ].map(({ key, label, unit }) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500 mb-1.5">
                      {label} ({unit})
                    </label>
                    <input
                      type="number"
                      value={measurements[key]}
                      onChange={(e) => setMeasurements(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="—"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-base focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveMeasurements}
                className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-medium rounded-full hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors duration-200"
              >
                {saved ? 'Saved ✓' : 'Save Measurements'}
              </button>
            </div>
          )}

          {activeTab === 'Orders' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Order History</h2>
              <OrdersTab />
            </div>
          )}

          {/* Wishlist Tab */}
          {activeTab === 'Wishlist' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Wishlist</h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {wishlistItems.length} item{wishlistItems.length !== 1 ? 's' : ''}
                </span>
              </div>

              {wishlistLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse flex gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : wishlistItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-base mb-4">Your wishlist is empty</p>
                  <Link
                    href="/product"
                    className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-medium rounded-full hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors duration-200"
                  >
                    Discover Products
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4">
                  {wishlistItems.map((product, index) => (
                    <motion.div
                      key={product._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors duration-200"
                    >
                      {/* Product Image */}
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/product/${product._id}`}
                              className="text-base font-medium text-slate-900 dark:text-white hover:text-slate-600 dark:hover:text-slate-300 transition-colors line-clamp-1"
                            >
                              {product.name}
                            </Link>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                              {product.brand}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <StarRating rating={product.rating || 0} />
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                ({product.numReviews || 0})
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-base font-semibold text-slate-900 dark:text-white">
                              {product.price} EGP
                            </span>
                            <div className="flex items-center justify-center">
                              <WishlistHeart productId={product._id} size="sm" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

        </motion.div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Try-On', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', href: '/try-on' },
            { label: 'Products', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', href: '/product' },
            { label: 'Brands', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', href: '/brand' },
            { label: 'Contact', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', href: '/contact' },
          ].map(({ label, icon, href }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center gap-2 p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-slate-400 dark:hover:border-slate-500 transition-colors duration-200 group"
            >
              <svg className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
              </svg>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{label}</span>
            </Link>
          ))}
        </div>

      </div>
    </section>
  )
}

export default ProfilePage
