'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useFormik } from 'formik'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { loginRequest } from '@/services/authService'
import { useToast } from '@/contexts/ToastContext'
import { loginSchema } from '@/lib/validationSchemas'
import GoogleLoginButton from '@/components/ui/GoogleLoginButton'

const Login = () => {
  const { login } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema: loginSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        const response = await loginRequest(values)
        login(response.data)
        toast.success('Login successful!')
        response.data.isAdmin ? router.push('/dashboard') : router.push('/')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Invalid credentials')
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    // هنا استخدمنا slate-900 عشان يطابق الناف بار بالظبط في الدارك مود
    <section className="relative min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center px-4 overflow-hidden transition-colors duration-500 font-serif">
      
      {/* تأثير إضاءة خفيف في الخلفية عشان متبقاش كئيبة */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-100 dark:bg-slate-800/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-100 dark:bg-slate-800/30 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-lg relative z-10 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-light text-slate-900 dark:text-slate-100 tracking-tight mb-3 italic">
            Welcome back
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-light">
            Enter your details to access your account
          </p>
        </motion.div>

        {/* Form Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          // هنا الـ Card واخد slate-800 في الدارك مود عشان يبرز عن الخلفية الـ slate-900
          className="bg-white dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 p-8 md:p-12 rounded-[2rem] shadow-2xl shadow-slate-200/50 dark:shadow-none"
        >
          <form onSubmit={formik.handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-widest text-slate-600 dark:text-slate-300 ml-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                {...formik.getFieldProps('email')}
                placeholder="name@example.com"
                className={`w-full px-6 py-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border transition-all duration-300 ${
                  formik.touched.email && formik.errors.email
                    ? 'border-red-400'
                    : 'border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-white'
                } text-slate-900 dark:text-white outline-none`}
              />
              {formik.touched.email && formik.errors.email && (
                <p className="text-red-500 text-xs ml-2">{formik.errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="block text-xs font-medium uppercase tracking-widest text-slate-600 dark:text-slate-300">
                  Password
                </label>
                <button
                    type="button"
                    disabled={isResetting || formik.isSubmitting}
                    onClick={async () => {
                      const emailValue = formik.values.email;

                      if (!emailValue) {
                        toast.error("Please enter your email address first so we know where to send the link!");
                        return;
                      }

                      try {
                        setIsResetting(true);
                        toast.info("Checking records and sending recovery link...");

                        const response = await fetch("http://localhost:5000/api/auth/forgot-password", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: emailValue }),
                        });

                        const data = await response.json();

                        if (response.ok) {
                          toast.success("Check your inbox! Reset link sent successfully.");
                        } else {
                          toast.error(data.message || "Could not process password recovery request.");
                        }
                      } catch (err) {
                        toast.error("Network error trying to contact recovery server.");
                      } finally {
                        setIsResetting(false);
                      }
                    }}
                    title="Reset password"
                    className={`text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ${
                        isResetting ? "opacity-50 cursor-wait" : ""
                    }`}
                >
                  {isResetting ? "Sending..." : "Forgot?"}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  {...formik.getFieldProps('password')}
                  placeholder="••••••••"
                  className={`w-full px-6 py-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border transition-all duration-300 ${
                    formik.touched.password && formik.errors.password
                      ? 'border-red-400'
                      : 'border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-white'
                  } text-slate-900 dark:text-white outline-none`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={formik.isSubmitting}
              className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-medium tracking-widest uppercase text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {formik.isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-700" /></div>
            <span className="relative px-4 bg-white dark:bg-slate-800/0 dark:backdrop-blur-none text-slate-400 text-xs uppercase tracking-widest block w-max mx-auto">
              Or continue with
            </span>
          </div>

          <GoogleLoginButton />
        </motion.div>

        {/* Footer Link */}
        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Don't have an account?{' '}
          <Link href="/register" className="text-slate-900 dark:text-white font-bold hover:underline underline-offset-4">
            Join us now
          </Link>
        </p>
      </div>
    </section>
  )
}

export default Login