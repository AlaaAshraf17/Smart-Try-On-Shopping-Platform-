'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
// import Link from 'next/link'
import { motion } from 'framer-motion'

const Herosection = () => {

  const router = useRouter()
  const { user, loading } = useAuth()

  const handleTryOnRedirect = (e) => {
    e.preventDefault()
    if (loading) return
    if (user) {
      router.push('/find-my-fit')
    } else {
      router.push('/login')
    }
  }

  return (
    <section className="relative bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-[70vh] py-20 text-center">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6"
          >
            <span className="inline-block px-4 py-1.5 text-xs font-medium tracking-wider text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-full">
              Next-Gen Fashion Technology
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-serif font-normal mb-6 max-w-4xl"
          >
            Try Before You Buy
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-7 max-w-2xl"
          >
            AI Smart Try-On Shopping Experience
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-12 max-w-2xl"
          >
            Upload your photo, select any garment, and see exactly how it fits your unique shape — before you spend a single penny. Powered by AI image-processing that overlays real clothing onto real you.
          </motion.p>

          {/* Upload your photo, select any garment, and see exactly how it fits your unique shape — before you spend a single penny. Powered by AI image-processing that overlays real clothing onto real you. */}

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={handleTryOnRedirect}
              disabled={loading}
              className="inline-block px-8 py-3 text-sm font-medium tracking-wider bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors duration-200"
            >
              {loading ? 'LOADING PROFILE...' : 'START TRYING'}
            </button>
          </motion.div>

        </div>
      </div>

      {/* Bottom Section - 3 Cards */}
      <div className="bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* Card 1 - Shop */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-3">
                Browse
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Explore a wide collection of fashion items and choose the styles you want to try in 3D.
              </p>
            </motion.div>

            {/* Card 2 - Checkout */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-center"
            >
              <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-3">
                Try in 3D
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Upload your photo and select a clothing item to see how it looks on you before buying.
              </p>
            </motion.div>

            {/* Card 3 - Try */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center"
            >
              <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-3">
                Shop with Confidence
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Select the perfect fit and purchase with confidence after seeing the real look.
              </p>
            </motion.div>

          </div>
        </div>
      </div>

      {/* Decorative Element */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

    </section>
  )
}

export default Herosection
