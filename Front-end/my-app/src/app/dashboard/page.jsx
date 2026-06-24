'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useToast } from '@/contexts/ToastContext'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { API } from '@/lib/axios'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

function StatCard({ label, value, icon, loading }) {
  return (
    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
          {loading ? <span className="animate-pulse text-slate-300 dark:text-slate-600">···</span> : value}
        </p>
      </div>
    </div>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-serif text-lg text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  )
}

const INPUT = "w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
const BTN_PRIMARY = "px-5 py-2.5 text-sm font-medium tracking-wider bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
const BTN_GHOST = "px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"

function OverviewTab({ summary, recentUsers, recentProducts, loading }) {
  const stats = [
    { label: 'Total Revenue', value: `${Number(summary?.totalSales || 0).toFixed(0)} EGP`, icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Total Orders', value: summary?.numOrders ?? '—', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
    { label: 'Total Users', value: summary?.userCount ?? '—', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Total Products', value: summary?.productCount ?? '—', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <StatCard {...s} loading={loading} />
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Recent Users</h2>
            <span className="text-xs text-slate-400">Latest 5</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                </div>
              </div>
            )) : recentUsers.map(u => (
              <div key={u._id} className="px-6 py-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-xs font-bold flex-shrink-0">
                  {u.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{u.name}</p>
                  <p className="text-xs text-slate-400 truncate">{u.email}</p>
                </div>
                {u.isAdmin && <span className="text-[10px] px-2 py-0.5 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-full">Admin</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Products */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Recent Products</h2>
            <span className="text-xs text-slate-400">Latest 5</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/5" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
                </div>
              </div>
            )) : recentProducts.map(p => (
              <div key={p._id} className="px-6 py-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 relative">
                  {p.image ? <Image src={p.image} alt={p.name} fill className="object-cover" sizes="40px" /> : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{p.price} EGP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function UsersTab() {
  const { toast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', isAdmin: false })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const { data } = await API.get('/api/users'); setUsers(data) }
    catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    try {
      await API.delete(`/api/users/${deleteTarget._id}`)
      toast.success('User deleted')
      setDeleteTarget(null)
      load()
    } catch { toast.error('Failed to delete user') }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/api/users', form)
      toast.success('User created')
      setAddOpen(false)
      setForm({ name: '', email: '', password: '', isAdmin: false })
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create user') }
    finally { setSaving(false) }
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'All' || (roleFilter === 'Admin' ? u.isAdmin : !u.isAdmin)
    return matchSearch && matchRole
  })

  return (
    <div className="space-y-6">
      {/* toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['All', 'Admin', 'User'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-4 py-1.5 text-xs font-medium tracking-wider rounded-full border transition-all ${roleFilter === r ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-500'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className={`${INPUT} pl-9`} />
          </div>
          <button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}>+ Add User</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">User</th>
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Email</th>
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Role</th>
                <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" /><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24" /></div></td>
                  <td className="px-6 py-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-36" /></td>
                  <td className="px-6 py-4"><div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-14" /></td>
                  <td className="px-6 py-4" />
                </tr>
              )) : filtered.map(u => (
                <tr key={u._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-xs font-bold flex-shrink-0">
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${u.isAdmin ? 'border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400' : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}>
                      {u.isAdmin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setDeleteTarget(u)} className="text-xs text-red-400 hover:text-red-600 transition-colors">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <p className="text-center py-10 text-slate-400 text-sm">No users found.</p>}
        </div>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <Modal open title="Delete User" onClose={() => setDeleteTarget(null)}>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">{deleteTarget.name}</span>? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className={BTN_GHOST}>Cancel</button>
              <button onClick={handleDelete} className="px-5 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Add user */}
      <AnimatePresence>
        {addOpen && (
          <Modal open title="Add New User" onClose={() => setAddOpen(false)}>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Name</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={INPUT} placeholder="Full name" /></div>
              <div><label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Email</label><input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={INPUT} placeholder="email@example.com" /></div>
              <div><label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Password</label><input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={INPUT} placeholder="Min 8 characters" /></div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isAdmin} onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Admin role</span>
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className={BTN_GHOST}>Cancel</button>
                <button type="submit" disabled={saving} className={BTN_PRIMARY}>{saving ? 'Creating...' : 'Create User'}</button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── PRODUCTS TAB ─────────────────────────────────────────────────────────────
const CATEGORIES = ['Clothes', 'Watches', 'Jewellery', 'Scarves', 'Footwear', 'Bags', 'Accessories']
const EMPTY_PRODUCT = { name: '', brand: '', category: 'Clothes', description: '', price: '', countInStock: '', image: '', glbModel: '' }

function ProductsTab() {
  const { toast } = useToast()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null = add, object = edit
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [uploading, setUploading] = useState({ image: false, glb: false })
  const imageRef = useRef()
  const glbRef = useRef()

  const load = async () => {
    setLoading(true)
    try {
      // Fetch all pages so the admin sees every product
      const first = await API.get('/api/products?pageNumber=1')
      const totalPages = first.data.pages || 1
      let all = first.data.products || []
      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            API.get(`/api/products?pageNumber=${i + 2}`)
          )
        )
        rest.forEach(r => { all = all.concat(r.data.products || []) })
      }
      setProducts(all)
    } catch { toast.error('Failed to load products') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(EMPTY_PRODUCT); setModalOpen(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({ name: p.name, brand: p.brand, category: p.category, description: p.description, price: p.price, countInStock: p.countInStock, image: p.image, glbModel: p.glbModel || '' })
    setModalOpen(true)
  }

  const uploadFile = async (file, field) => {
    const key = field === 'image' ? 'image' : 'glb'
    setUploading(u => ({ ...u, [key]: true }))
    try {
      const fd = new FormData(); fd.append('file', file)
      const { data } = await API.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm(f => ({ ...f, [field]: data.url }))
      toast.success(`${key === 'image' ? 'Image' : '3D model'} uploaded`)
    } catch { toast.error('Upload failed') }
    finally { setUploading(u => ({ ...u, [key]: false })) }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await API.put(`/api/products/${editing._id}`, { ...form, price: Number(form.price), countInStock: Number(form.countInStock) })
        toast.success('Product updated')
      } else {
        await API.post('/api/products', { ...form, price: Number(form.price), countInStock: Number(form.countInStock) })
        toast.success('Product created')
      }
      setModalOpen(false)
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save product') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await API.delete(`/api/products/${deleteTarget._id}`)
      toast.success('Product deleted')
      setDeleteTarget(null)
      load()
    } catch { toast.error('Failed to delete product') }
  }

  const filtered = products.filter(p => {
    const matchCat = catFilter === 'All' || p.category === catFilter
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="space-y-6">
      {/* toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['All', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 text-xs font-medium tracking-wider rounded-full border transition-all ${catFilter === c ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-500'}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className={`${INPUT} pl-9`} />
          </div>
          <button onClick={openAdd} className={BTN_PRIMARY}>+ Add Product</button>
        </div>
      </div>

      {/* grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {loading ? Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden animate-pulse">
            <div className="aspect-square bg-slate-200 dark:bg-slate-700" />
            <div className="p-4 space-y-2"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" /><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" /></div>
          </div>
        )) : filtered.map(p => (
          <div key={p._id} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden group">
            <div className="aspect-square relative bg-slate-100 dark:bg-slate-800">
              {p.image ? <Image src={p.image} alt={p.name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" /> : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              )}
              {p.glbModel && (
                <div className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-600 rounded-full text-slate-600 dark:text-slate-300">3D</div>
              )}
              {p.countInStock === 0 && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Out of Stock</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug truncate">{p.name}</h4>
                <span className="text-sm font-bold text-slate-900 dark:text-white flex-shrink-0">{p.price} EGP</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">{p.brand} · {p.category}</p>
              <div className="flex gap-2">
                <button onClick={() => openEdit(p)} className="flex-1 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Edit</button>
                <button onClick={() => setDeleteTarget(p)} className="flex-1 py-1.5 text-xs font-medium border border-red-200 dark:border-red-900/50 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!loading && filtered.length === 0 && <p className="text-center py-10 text-slate-400 text-sm">No products found.</p>}

      {/* Add/Edit modal */}
      <AnimatePresence>
        {modalOpen && (
          <Modal open title={editing ? 'Edit Product' : 'Add Product'} onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Name</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={INPUT} placeholder="Product name" /></div>
                <div><label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Brand</label><input required value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className={INPUT} placeholder="Brand" /></div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={INPUT}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Price (EGP)</label><input required type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={INPUT} placeholder="0" /></div>
                <div><label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Stock</label><input required type="number" min="0" value={form.countInStock} onChange={e => setForm(f => ({ ...f, countInStock: e.target.value }))} className={INPUT} placeholder="0" /></div>
                <div className="col-span-2"><label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Description</label><textarea required rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${INPUT} resize-none`} placeholder="Product description" /></div>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Product Image</label>
                <div className="flex gap-3 items-center">
                  <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadFile(e.target.files[0], 'image')} />
                  <button type="button" onClick={() => imageRef.current.click()} disabled={uploading.image} className={`${BTN_GHOST} flex-shrink-0`}>
                    {uploading.image ? 'Uploading...' : 'Upload Image'}
                  </button>
                  {form.image && <span className="text-xs text-emerald-500 truncate">✓ Image uploaded</span>}
                </div>
              </div>

              {/* GLB upload */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">3D Model (GLB) — optional</label>
                <div className="flex gap-3 items-center">
                  <input ref={glbRef} type="file" accept=".glb,.gltf" className="hidden" onChange={e => e.target.files[0] && uploadFile(e.target.files[0], 'glbModel')} />
                  <button type="button" onClick={() => glbRef.current.click()} disabled={uploading.glb} className={`${BTN_GHOST} flex-shrink-0`}>
                    {uploading.glb ? 'Uploading...' : 'Upload GLB'}
                  </button>
                  {form.glbModel && <span className="text-xs text-emerald-500 truncate">✓ 3D model uploaded</span>}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className={BTN_GHOST}>Cancel</button>
                <button type="submit" disabled={saving || uploading.image || uploading.glb} className={BTN_PRIMARY}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Product'}</button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <Modal open title="Delete Product" onClose={() => setDeleteTarget(null)}>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Delete <span className="font-semibold text-slate-900 dark:text-white">{deleteTarget.name}</span>? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className={BTN_GHOST}>Cancel</button>
              <button onClick={handleDelete} className="px-5 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── ORDERS TAB (admin) ───────────────────────────────────────────────────────
const PAYMENT_LABELS = { cash: 'Cash on Delivery', card: 'Card', paypal: 'PayPal' }

function OrdersTab() {
  const { toast } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('All')
  const [updating, setUpdating] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      // GET /api/orders/all — admin endpoint that returns every order across all users
      const { data } = await API.get('/api/orders/all')
      setOrders(data)
    } catch { toast.error('Failed to load orders') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleMarkPaid = async (orderId) => {
    setUpdating(orderId + '_pay')
    try {
      await API.put(`/api/orders/${orderId}/pay`)
      toast.success('Marked as paid')
      load()
    } catch { toast.error('Failed to update') }
    finally { setUpdating(null) }
  }

  const handleMarkDelivered = async (orderId) => {
    setUpdating(orderId + '_deliver')
    try {
      await API.put(`/api/orders/${orderId}/deliver`)
      toast.success('Marked as delivered')
      load()
    } catch { toast.error('Failed to update') }
    finally { setUpdating(null) }
  }

  const filtered = orders.filter(o => {
    if (statusFilter === 'Unpaid') return !o.isPaid
    if (statusFilter === 'Paid') return o.isPaid && !o.isDelivered
    if (statusFilter === 'Delivered') return o.isDelivered
    return true
  })

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Unpaid', 'Paid', 'Delivered'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 text-xs font-medium tracking-wider rounded-full border transition-all ${statusFilter === s ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-500'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Order ID</th>
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Customer</th>
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Date</th>
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment</th>
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Total</th>
                <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32" /></td>
                  <td className="px-6 py-4"><div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-28" /></td>
                  <td className="px-6 py-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-20" /></td>
                  <td className="px-6 py-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24" /></td>
                  <td className="px-6 py-4"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-16" /></td>
                  <td className="px-6 py-4"><div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-20" /></td>
                  <td className="px-6 py-4" />
                </tr>
              )) : filtered.map(order => (
                <tr key={order._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/order/${order._id}`} className="font-mono text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                      {order._id.slice(-8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{order.user?.name || '—'}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{order.user?.email || ''}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                    {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                    {Number(order.totalPrice).toFixed(2)} EGP
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${order.isPaid ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400' : 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'}`}>
                        {order.isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${order.isDelivered ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}>
                        {order.isDelivered ? 'Delivered' : 'Pending'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end flex-wrap">
                      {!order.isPaid && (
                        <button
                          onClick={() => handleMarkPaid(order._id)}
                          disabled={updating === order._id + '_pay'}
                          className="text-xs px-3 py-1.5 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 transition-colors"
                        >
                          {updating === order._id + '_pay' ? '...' : 'Mark Paid'}
                        </button>
                      )}
                      {order.isPaid && !order.isDelivered && (
                        <button
                          onClick={() => handleMarkDelivered(order._id)}
                          disabled={updating === order._id + '_deliver'}
                          className="text-xs px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                          {updating === order._id + '_deliver' ? '...' : 'Mark Delivered'}
                        </button>
                      )}
                      <Link href={`/order/${order._id}`} className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <p className="text-center py-10 text-slate-400 text-sm">No orders found.</p>}
        </div>
      </div>
    </div>
  )
}

// ─── SUPPORT TAB ─────────────────────────────────────────────────────────────

function SupportTab({ adminId, adminName, conversations, setConversations, connected, socketRef }) {
  const [selected, setSelected] = useState(null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, selected])

  // When admin opens a conversation, clear unread count
  const openConversation = (senderId) => {
    setSelected(senderId)
    setConversations((prev) => {
      if (!prev[senderId]) return prev
      return { ...prev, [senderId]: { ...prev[senderId], unread: 0 } }
    })
  }

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || !selected || !socketRef.current) return

    const payload = {
      receiverId: selected,
      senderId: adminId,
      senderName: adminName,
      message: text,
    }

    socketRef.current.emit('send_support_message', payload)

    // Optimistically add to conversation
    setConversations((prev) => {
      const existing = prev[selected] || { senderName: selected, messages: [], unread: 0 }
      return {
        ...prev,
        [selected]: {
          ...existing,
          messages: [
            ...existing.messages,
            { ...payload, timestamp: new Date().toISOString(), fromMe: true },
          ],
          lastTime: new Date().toISOString(),
        },
      }
    })
    setInput('')
  }, [input, selected, adminId, adminName])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const sortedConvIds = Object.keys(conversations).sort((a, b) => {
    const tA = new Date(conversations[a].lastTime || 0).getTime()
    const tB = new Date(conversations[b].lastTime || 0).getTime()
    return tB - tA
  })

  const selectedConv = selected ? conversations[selected] : null
  const totalUnread = Object.values(conversations).reduce((sum, c) => sum + (c.unread || 0), 0)

  return (
    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Support Conversations</h2>
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
              {totalUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-400'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="flex" style={{ height: '520px' }}>
        {/* Left: conversation list */}
        <div className="w-64 flex-shrink-0 border-r border-slate-100 dark:border-slate-700 overflow-y-auto">
          {sortedConvIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm text-center px-4">
              <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              No messages yet
            </div>
          ) : (
            sortedConvIds.map((senderId) => {
              const conv = conversations[senderId]
              const lastMsg = conv.messages[conv.messages.length - 1]
              const isActive = selected === senderId
              return (
                <button
                  key={senderId}
                  onClick={() => openConversation(senderId)}
                  className={`w-full text-left px-4 py-3.5 border-b border-slate-50 dark:border-slate-700/50 transition-colors
                    ${isActive
                      ? 'bg-slate-100 dark:bg-slate-700/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[120px]">
                      {conv.senderName}
                    </p>
                    {conv.unread > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-blue-600 text-white rounded-full flex-shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="text-xs text-slate-400 truncate">
                      {lastMsg.fromMe ? 'You: ' : ''}{lastMsg.message}
                    </p>
                  )}
                  {conv.lastTime && (
                    <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">
                      {new Date(conv.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Right: message thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                <p className="font-semibold text-sm text-slate-900 dark:text-white">
                  {selectedConv?.senderName}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">{selected}</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                {selectedConv?.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-snug break-words
                        ${msg.fromMe
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-br-sm'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm'}`}
                    >
                      <p>{msg.message}</p>
                      {msg.timestamp && (
                        <p className={`text-[10px] mt-1 opacity-50 ${msg.fromMe ? 'text-right' : ''}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 flex-shrink-0">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Reply to ${selectedConv?.senderName}…`}
                  className={INPUT}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`${BTN_PRIMARY} flex-shrink-0 disabled:opacity-40`}
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ANALYTICS TAB ────────────────────────────────────────────────────────────

const DONUT_COLORS = ['#10b981', '#f59e0b']   // emerald / amber
const LINE_COLOR   = '#3b82f6'                 // blue-500

function AnalyticsTab({ allOrders, ordersLoading, aiQueueLength, tryOnSessionCount, activityFeed }) {
  // ── 1. Monthly revenue from paid orders ───────────────────────────────────
  const revenueByMonth = (() => {
    const map = {}
    allOrders.filter(o => o.isPaid).forEach(o => {
      const d   = new Date(o.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const lbl = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!map[key]) map[key] = { month: lbl, revenue: 0 }
      map[key].revenue += Number(o.totalPrice)
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, revenue: parseFloat(v.revenue.toFixed(2)) }))
  })()

  // ── 4. Paid / Unpaid donut ─────────────────────────────────────────────────
  const paidCount   = allOrders.filter(o => o.isPaid).length
  const unpaidCount = allOrders.length - paidCount
  const donutData   = [
    { name: 'Paid',   value: paidCount   },
    { name: 'Unpaid', value: unpaidCount },
  ]

  // ── Activity feed icon helper ──────────────────────────────────────────────
  const activityIcon = (type) => {
    if (type === 'order')         return { icon: '🛍️', color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/20' }
    if (type === 'tryon_start')   return { icon: '🎨', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' }
    if (type === 'tryon_success') return { icon: '✅', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' }
    if (type === 'tryon_error')   return { icon: '❌', color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20' }
    if (type === 'revenue')       return { icon: '💰', color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20' }
    return { icon: '📋', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' }
  }

  return (
    <div className="space-y-8">

      {/* ── Live counters row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'AI Queue',
            value: aiQueueLength,
            sub:   aiQueueLength === 0 ? 'Idle' : 'Processing',
            pulse: aiQueueLength > 0,
            color: 'text-violet-600 dark:text-violet-400',
          },
          {
            label: 'Try-Ons This Session',
            value: tryOnSessionCount,
            sub:   'Since you opened dashboard',
            pulse: false,
            color: 'text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Total Orders',
            value: allOrders.length,
            sub:   `${paidCount} paid`,
            pulse: false,
            color: 'text-slate-900 dark:text-white',
          },
          {
            label: 'Total Revenue',
            value: `${allOrders.filter(o => o.isPaid).reduce((s, o) => s + Number(o.totalPrice), 0).toFixed(0)} EGP`,
            sub:   'From paid orders',
            pulse: false,
            color: 'text-emerald-600 dark:text-emerald-400',
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-2">
              {card.pulse && <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />}
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{card.label}</p>
            </div>
            <p className={`text-3xl font-bold ${card.color}`}>{ordersLoading ? '···' : card.value}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* 1. Monthly Revenue Line Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Monthly Revenue</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Paid orders only · EGP</p>
          {ordersLoading ? (
            <div className="h-48 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : revenueByMonth.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No paid orders yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueByMonth} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }}
                  formatter={(v) => [`${v} EGP`, 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke={LINE_COLOR} strokeWidth={2.5} dot={{ r: 4, fill: LINE_COLOR }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 4. Paid/Unpaid Donut */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Payment Status</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Paid vs Unpaid orders</p>
          {ordersLoading ? (
            <div className="h-48 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : allOrders.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No orders yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: '#94a3b8' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── 7. Live Activity Feed ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Live Activity</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Real-time events from this session</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50 max-h-72 overflow-y-auto">
          {activityFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm">
              <span className="text-2xl mb-2">📡</span>
              Waiting for activity...
            </div>
          ) : (
            activityFeed.map((event) => {
              const { icon, bg } = activityIcon(event.type)
              return (
                <div key={event.id} className="flex items-start gap-4 px-6 py-3.5">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${bg}`}>
                    {icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-200">{event.message}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{event.time}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
const TABS = ['Overview', 'Users', 'Products', 'Orders', 'Analytics', 'Support']

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Overview')
  const [summary, setSummary] = useState(null)
  const [recentUsers, setRecentUsers] = useState([])
  const [recentProducts, setRecentProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Support chat state ─────────────────────────────────────────────────────
  const [conversations, setConversations] = useState({})
  const [supportConnected, setSupportConnected] = useState(false)
  const supportSocketRef = useRef(null)
  const supportJoinedRef = useRef(false)

  // ── Analytics state ────────────────────────────────────────────────────────
  const [allOrders, setAllOrders]                 = useState([])
  const [ordersLoading, setOrdersLoading]         = useState(true)
  const [aiQueueLength, setAiQueueLength]         = useState(0)
  const [tryOnSessionCount, setTryOnSessionCount] = useState(0)
  const [activityFeed, setActivityFeed]           = useState([])

  const pushActivity = useCallback((type, message) => {
    setActivityFeed(prev => [{
      id:   Date.now() + Math.random(),
      type, message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...prev].slice(0, 20))
  }, [])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (!user.isAdmin) { router.push('/'); return }

    const fetchOverview = async () => {
      try {
        const [sumRes, usersRes, prodsRes] = await Promise.all([
          API.get('/api/orders/summary'),
          API.get('/api/users'),
          API.get('/api/products'),
        ])
        setSummary(sumRes.data)
        setRecentUsers(usersRes.data.slice(0, 5))
        setRecentProducts(prodsRes.data.products?.slice(0, 5) ?? [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchOverview()

    // ── Fetch all orders for analytics charts ─────────────────────────────
    const fetchAllOrders = async () => {
      setOrdersLoading(true)
      try { const { data } = await API.get('/api/orders/all'); setAllOrders(data) }
      catch (e) { console.error(e) }
      finally { setOrdersLoading(false) }
    }
    fetchAllOrders()

    // ── Socket: support chat + analytics events ────────────────────────────
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    supportSocketRef.current = socket

    socket.on('connect', () => {
      setSupportConnected(true)
      if (!supportJoinedRef.current) {
        socket.emit('join_chat', 'support')
        supportJoinedRef.current = true
      }
    })

    socket.on('disconnect', () => setSupportConnected(false))

    socket.on('receive_support_message', (data) => {
      const { senderId, senderName, message, timestamp } = data
      setConversations((prev) => {
        const existing = prev[senderId] || { senderName, messages: [], unread: 0 }
        return {
          ...prev,
          [senderId]: {
            senderName: senderName || existing.senderName,
            messages: [...existing.messages, { senderId, senderName, message, timestamp, fromMe: false }],
            unread: existing.unread + 1,
            lastTime: timestamp || new Date().toISOString(),
          },
        }
      })
    })

    // ── Analytics socket events ────────────────────────────────────────────
    socket.on('admin:queueUpdate', ({ queueLength }) => {
      setAiQueueLength(queueLength ?? 0)
    })

    socket.on('admin:updateAnalytics', (data) => {
      if (data.type === 'TRYON_STARTED') {
        setAiQueueLength(data.queueLength ?? 0)
        pushActivity('tryon_start', `Try-On started${data.user ? ` by ${data.user}` : ''}`)
      }
      if (data.type === 'TRYON_SUCCESS') {
        setTryOnSessionCount(c => c + 1)
        setAiQueueLength(data.queueLength ?? 0)
        pushActivity('tryon_success', 'Try-On completed successfully')
      }
      if (data.type === 'TRYON_ERROR') {
        setAiQueueLength(data.queueLength ?? 0)
        pushActivity('tryon_error', 'Try-On failed — AI error')
      }
    })

    socket.on('admin:newOrder', ({ totalPrice }) => {
      pushActivity('order', `New order placed — ${Number(totalPrice ?? 0).toFixed(0)} EGP`)
      // Refresh orders so the revenue chart updates
      API.get('/api/orders/all').then(({ data }) => setAllOrders(data)).catch(() => {})
    })

    socket.on('admin:revenueUpdate', ({ amount }) => {
      pushActivity('revenue', `Order marked paid — ${Number(amount ?? 0).toFixed(0)} EGP`)
      API.get('/api/orders/all').then(({ data }) => setAllOrders(data)).catch(() => {})
    })

    socket.on('admin:errorAlert', ({ user: u, error }) => {
      pushActivity('tryon_error', `Error for ${u || 'user'}: ${(error ?? '').slice(0, 60)}`)
    })

    return () => {
      socket.disconnect()
      supportSocketRef.current = null
      supportJoinedRef.current = false
    }
  }, [user, router, pushActivity])

  if (!user || !user.isAdmin) return null

  return (
    <section className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10 px-4 font-serif">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Welcome back, {user.name}</p>
          </div>
          <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">← Back to site</Link>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {TABS.map(tab => {
            const supportUnread = tab === 'Support'
              ? Object.values(conversations).reduce((s, c) => s + (c.unread || 0), 0)
              : 0
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-6 py-3 text-sm font-medium tracking-wide transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab}
                {supportUnread > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full">
                    {supportUnread}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {activeTab === 'Overview'   && <OverviewTab summary={summary} recentUsers={recentUsers} recentProducts={recentProducts} loading={loading} />}
            {activeTab === 'Users'      && <UsersTab />}
            {activeTab === 'Products'   && <ProductsTab />}
            {activeTab === 'Orders'     && <OrdersTab />}
            {activeTab === 'Analytics'  && (
              <AnalyticsTab
                allOrders={allOrders}
                ordersLoading={ordersLoading}
                aiQueueLength={aiQueueLength}
                tryOnSessionCount={tryOnSessionCount}
                activityFeed={activityFeed}
              />
            )}
            {activeTab === 'Support'    && <SupportTab adminId={user._id} adminName={user.name} conversations={conversations} setConversations={setConversations} connected={supportConnected} socketRef={supportSocketRef} />}
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  )
}
