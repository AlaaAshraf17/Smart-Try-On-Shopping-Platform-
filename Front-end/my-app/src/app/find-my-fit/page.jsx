"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useState, useCallback, useEffect, useRef } from "react";
import { API } from "@/lib/axios";
import { io } from "socket.io-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";


const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
  });

const getAuthToken = (user) => {
  if (user?.token) return user.token;
  if (user?.accessToken) return user.accessToken;
  return localStorage.getItem("token") || localStorage.getItem("accessToken") || null;
};

const generateRoomId = () => `FIT-${Math.floor(1000 + Math.random() * 9000)}`;
const STEPS = [
  { label: "Preparing your photo…",     progress: 8,  duration: 4000  },
  { label: "Uploading to cloud…",        progress: 18, duration: 5000  },
  { label: "Waking up AI engine…",       progress: 30, duration: 15000 },
  { label: "Connecting to AI…",          progress: 42, duration: 8000  },
  { label: "Analyzing your body…",       progress: 55, duration: 12000 },
  { label: "Fitting the garment…",       progress: 70, duration: 15000 },
  { label: "Refining details…",          progress: 82, duration: 10000 },
  { label: "Almost there…",             progress: 92, duration: 8000  },
  { label: "Saving your look…",          progress: 97, duration: 5000  },
];

function Toast({ notifications }) {
  return (
    <div className="fixed top-5 right-5 z-[100] space-y-2 pointer-events-none">
      {notifications.map((n) => (
        <div key={n.id} className="flex items-center gap-2 bg-slate-900 text-white border border-white/10 px-4 py-3 rounded-2xl text-xs font-semibold shadow-2xl"
          style={{ animation: "slideIn 0.3s ease" }}>
          <span className="text-blue-400">●</span>
          {n.text}
        </div>
      ))}
    </div>
  );
}

function StepLabel({ n, label, dark }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${dark ? "bg-white text-black" : "bg-slate-900 text-white"}`}>{n}</span>
      <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-50">{label}</h3>
    </div>
  );
}

function ProgressOverlay({ stepIndex, progress, dark }) {
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  return (
    <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-8 backdrop-blur-sm ${dark ? "bg-slate-900/92" : "bg-white/92"}`}>
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-2 border-blue-600/10 rounded-full" />
        <div className="absolute inset-0 border-t-2 border-blue-600 rounded-full animate-spin" />
        <div className="absolute inset-2 border-t border-blue-400/40 rounded-full animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
      </div>
      <div className="w-56 space-y-3 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 transition-all duration-500">
          {step?.label}
        </p>
        <div className={`w-full h-1 rounded-full overflow-hidden ${dark ? "bg-white/5" : "bg-slate-100"}`}>
          <div className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[9px] font-black opacity-30 tracking-widest">{Math.round(progress)}%</p>
      </div>
      {progress >= 88 && (
        <p className="text-[9px] opacity-25 uppercase tracking-widest text-center px-8">
          AI models take 60–120s on first run
        </p>
      )}
    </div>
  );
}

function RoomPanel({ roomId, members, onJoin, onLeave, onSendReaction, dark }) {
  const [copied, setCopied] = useState(false);
  const copyId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (!roomId) {
    return (
      <button onClick={onJoin} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${dark ? "border-white/10 hover:border-blue-500 hover:bg-blue-500/10" : "border-slate-200 hover:border-blue-500 hover:bg-blue-50"}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Share with Friends
      </button>
    );
  }
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-full border ${dark ? "bg-blue-500/10 border-blue-500/30" : "bg-blue-50 border-blue-200"}`}>
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      <span className="text-blue-600 text-xs font-black uppercase tracking-wider">{roomId}</span>
      <button onClick={copyId} className="text-[10px] font-black uppercase opacity-60 hover:opacity-100 transition-opacity">
        {copied ? "✓" : "Copy"}
      </button>
      {members > 1 && <span className="text-[10px] opacity-50">{members} online</span>}
      <div className="flex gap-1">
        {["❤️","🔥","😍"].map((e) => (
          <button key={e} onClick={() => onSendReaction(e)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-all text-sm">{e}</button>
        ))}
      </div>
      <button onClick={onLeave} className="text-[10px] font-black uppercase text-red-400 hover:text-red-300 transition-colors">Leave</button>
    </div>
  );
}

function JoinRoomModal({ onClose, onJoin, onCreate, dark }) {
  const [inputId, setInputId] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-sm rounded-[2rem] p-8 space-y-6 ${dark ? "bg-slate-900 border border-white/10" : "bg-white shadow-2xl"}`}>
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest">Collab Room</h3>
          <p className="text-xs opacity-40 mt-1"> real-time </p>
        </div>
        <div className="space-y-3">
          <input type="text" value={inputId} onChange={(e) => setInputId(e.target.value.toUpperCase())}
            placeholder="FIT-1234"
            className={`w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest border outline-none transition-all placeholder:opacity-30 ${dark ? "bg-white/5 border-white/10 focus:border-blue-500" : "bg-slate-50 border-slate-200 focus:border-blue-500"}`}
          />
          <button onClick={() => inputId.trim() && onJoin(inputId.trim())} disabled={!inputId.trim()}
            className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 transition-all">
            Join Room
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex-1 h-px ${dark ? "bg-white/5" : "bg-slate-100"}`} />
          <span className="text-[10px] opacity-30 uppercase font-bold">or</span>
          <div className={`flex-1 h-px ${dark ? "bg-white/5" : "bg-slate-100"}`} />
        </div>
        <button onClick={onCreate} className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${dark ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-50"}`}>
          Create New Room
        </button>
      </div>
    </div>
  );
}

function GarmentPicker({ clothes, selectedProduct, onSelect, onClose, dark }) {
  const [search, setSearch] = useState("");
  const filtered = clothes.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-lg rounded-[2.5rem] overflow-hidden flex flex-col ${dark ? "bg-slate-900 border border-white/10" : "bg-white shadow-2xl"}`}>
        <div className={`p-6 space-y-4 border-b ${dark ? "border-white/5" : "border-slate-100"}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-[0.4em]">Choose Garment</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full opacity-40 hover:opacity-100 transition-opacity text-lg">×</button>
          </div>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
            className={`w-full px-4 py-2.5 rounded-xl text-xs border outline-none transition-all ${dark ? "bg-white/5 border-white/10 focus:border-blue-500" : "bg-slate-50 border-slate-200 focus:border-blue-500"}`}
          />
        </div>
        <div className="p-4 space-y-2 max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 && <p className="text-center text-xs opacity-30 py-8 uppercase tracking-widest">No results</p>}
          {filtered.map((p) => (
            <div key={p._id} onClick={() => { onSelect(p); onClose(); }}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedProduct?._id === p._id ? "border-blue-600 bg-blue-600/5" : `border-transparent ${dark ? "hover:bg-white/5" : "hover:bg-slate-50"}`}`}>
              <div className={`w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden ${dark ? "bg-white/5" : "bg-slate-100"}`}>
                <img src={p.image} alt={p.name} className="w-full h-full object-contain p-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase tracking-widest truncate">{p.name}</p>
                {p.brand && <p className="text-[9px] opacity-40 uppercase mt-0.5">{p.brand}</p>}
              </div>
              {selectedProduct?._id === p._id && (
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FindMyFitPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const dark = theme === "dark";

  const socketRef      = useRef(null);
  const garmentCache   = useRef({});
  const progressTimer  = useRef(null);
  const abortRef       = useRef(null);
  const currentReqId   = useRef(null); 

  const [clothes, setClothes]                 = useState([]);
  const [loadingClothes, setLoadingClothes]   = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [pickerOpen, setPickerOpen]           = useState(false);
  const [personFile, setPersonFile]           = useState(null);
  const [previewPerson, setPreviewPerson]     = useState(null);
  const [resultImage, setResultImage]         = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [progress, setProgress]               = useState(0);
  const [stepIndex, setStepIndex]             = useState(0);
  const [error, setError]                     = useState("");

  const [roomId, setRoomId]                   = useState("");
  const [roomMembers, setRoomMembers]         = useState(1);
  const [showRoomModal, setShowRoomModal]     = useState(false);
  const [notifications, setNotifications]     = useState([]);
  const [queueLength, setQueueLength]         = useState(0);

  const addNotification = useCallback((text) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, text }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 4000);
  }, []);


  useEffect(() => {
    const socket = io(API_BASE_URL, { transports: ["websocket"], reconnectionAttempts: 5 });
    socketRef.current = socket;

    socket.on("admin:queueUpdate",     ({ queueLength: q }) => setQueueLength(q));
    socket.on("admin:updateAnalytics", ({ queueLength: q }) => { if (q !== undefined) setQueueLength(q); });
    socket.on("room:memberCount",      ({ count }) => setRoomMembers(count));
    socket.on("room:reaction",         ({ user: s, emoji }) => addNotification(`${s || "Someone"} reacted ${emoji}`));
    socket.on("receive_feedback",      (data) => { if (data?.message) addNotification(`${data.user || "Someone"}: ${data.message}`); });

    socket.on("tryOnCompleted", ({ resultImage: img, byUser, requestId }) => {
      if (!img) return;
      if (requestId && requestId !== currentReqId.current) return;
      clearProgressTimer();
      setProgress(100);
      setTimeout(() => {
        setResultImage(img);
        setLoading(false);
      }, 600);
      if (byUser && byUser !== user?.name) {
        addNotification(`${byUser} generated a new look!`);
      }
    });

    return () => socket.disconnect();
  }, [addNotification, user?.name]);

  const clearProgressTimer = () => {
    if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
  };

  const startProgressSimulation = () => {
    let currentStep = 0;
    let stepStart   = Date.now();
    clearProgressTimer();
    setProgress(0);
    setStepIndex(0);

    progressTimer.current = setInterval(() => {
      const step = STEPS[currentStep];
      if (!step) return;

      const elapsed  = Date.now() - stepStart;
      const fraction = Math.min(elapsed / step.duration, 1);
      const prevPct  = currentStep > 0 ? STEPS[currentStep - 1].progress : 0;
      setProgress(prevPct + fraction * (step.progress - prevPct));

      if (fraction >= 1) { currentStep++; stepStart = Date.now(); setStepIndex(currentStep); }
    }, 100);
  };

  useEffect(() => {
    const fetch_ = async () => {
      setLoadingClothes(true);
      try {
        const first = await API.get("/api/products?pageNumber=1");
        const pages = first.data.pages || 1;
        let all = first.data.products || [];
        if (pages > 1) {
          const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => API.get(`/api/products?pageNumber=${i + 2}`)));
          rest.forEach((r) => { all = all.concat(r.data.products || []); });
        }
        setClothes(all.filter((p) => p.category === "Clothes"));
      } catch { setError("Failed to load clothes."); }
      finally { setLoadingClothes(false); }
    };
    fetch_();
  }, []);

  const handlePersonFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please upload an image file."); return; }
    setPersonFile(file);
    setPreviewPerson(URL.createObjectURL(file));
    setError("");
    setResultImage(null);
  }, []);

  const handleJoinRoom    = (id) => { socketRef.current?.emit("join_session", id); setRoomId(id); setShowRoomModal(false); addNotification(`Joined room ${id}`); };
  const handleCreateRoom  = ()   => { const id = generateRoomId(); socketRef.current?.emit("join_session", id); setRoomId(id); setShowRoomModal(false); addNotification(`Room ${id} created!`); };
  const handleLeaveRoom   = ()   => { socketRef.current?.emit("leave_session", roomId); setRoomId(""); setRoomMembers(1); };
  const handleSendReaction = (emoji) => {
    if (!roomId) return;
    socketRef.current?.emit("send_feedback", { roomId, user: user?.name || "Guest", type: "reaction", emoji, message: emoji });
  };

  const handleTryOn = async () => {
    if (!personFile)      return setError("Please upload your photo first.");
    if (!selectedProduct) return setError("Please select a garment.");
    const token = getAuthToken(user);
    if (!token)           return setError("You must be logged in.");

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const requestId = Date.now().toString();
    currentReqId.current = requestId;

    setLoading(true);
    setError("");
    setResultImage(null);
    startProgressSimulation();
    socketRef.current?.emit("ai_request_started");

    try {
      const personBase64 = await fileToBase64(personFile);

      let garmentBase64 = garmentCache.current[selectedProduct._id];
      if (!garmentBase64) {
        const res  = await fetch(selectedProduct.image, { signal: abortRef.current.signal });
        const blob = await res.blob();
        garmentBase64 = await fileToBase64(blob);
        garmentCache.current[selectedProduct._id] = garmentBase64;
      }

      const response = await fetch(`${API_BASE_URL}/api/try-on`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          personImage:  personBase64,
          garmentImage: garmentBase64,
          description:  selectedProduct.name,
          roomId,
          requestId,  
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`Server error (${response.status})`);

      const result = await response.json();

      if (result.resultImage && requestId === currentReqId.current) {
        clearProgressTimer();
        setProgress(100);
        setTimeout(() => {
          setResultImage(result.resultImage);
          setLoading(false);
        }, 600);
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
      clearProgressTimer();
      socketRef.current?.emit("ai_request_finished");
    }
  };

  

  return (
    <div className={`min-h-screen transition-all duration-700 ${dark ? "bg-[#0a0f1e] text-white" : "bg-[#f6f8fc] text-slate-900"} p-6 md:p-12`}>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <Toast notifications={notifications} />

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] ${dark ? "bg-blue-600/15" : "bg-blue-400/8"}`} />
        <div className={`absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] ${dark ? "bg-indigo-600/15" : "bg-indigo-400/8"}`} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-14">

        <header className={`flex flex-col md:flex-row md:items-center justify-between gap-6 pb-10 border-b ${dark ? "border-white/5" : "border-slate-200"}`}>
          <div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none uppercase">
              FITTING<span className="text-blue-600">ROOM</span>
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-[9px] tracking-[0.7em] font-bold opacity-30 uppercase">A.I Virtual Atelier</p>
              {queueLength > 0 && (
                <span className={`text-[9px] px-2 py-1 rounded-full font-black uppercase tracking-wider ${dark ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-700"}`}>
                  {queueLength} in queue
                </span>
              )}
            </div>
          </div>
          <RoomPanel roomId={roomId} members={roomMembers} onJoin={() => setShowRoomModal(true)} onLeave={handleLeaveRoom} onSendReaction={handleSendReaction} dark={dark} />
        </header>

        <div className="grid lg:grid-cols-2 gap-16 items-start">

          <div className="space-y-10">

            <div className="space-y-5">
              <StepLabel n="01" label="Your Portrait" dark={dark} />
              <label className={`group relative block aspect-[4/5] rounded-[2.5rem] border-2 border-dashed transition-all duration-500 overflow-hidden cursor-pointer ${dark ? "bg-slate-900/60 border-slate-700 hover:border-blue-500" : "bg-white border-slate-200 hover:border-blue-400 shadow-sm"}`}>
                {previewPerson ? (
                  <>
                    <img src={previewPerson} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[9px] font-black uppercase tracking-widest bg-black/50 px-4 py-2 rounded-full">Change</span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-20">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <p className="text-[9px] font-black uppercase tracking-[0.5em]">Upload Photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePersonFileChange} />
              </label>
            </div>

            <div className="space-y-5">
              <StepLabel n="02" label="Garment" dark={dark} />
              <button onClick={() => !loadingClothes && setPickerOpen(true)} disabled={loadingClothes}
                className={`w-full p-5 rounded-[1.5rem] border-2 border-dashed transition-all duration-300 flex items-center gap-5 text-left ${
                  selectedProduct
                    ? `border-solid ${dark ? "border-blue-500/30 bg-blue-500/5" : "border-blue-200 bg-blue-50/50"}`
                    : `${dark ? "border-slate-700 hover:border-blue-500 bg-slate-900/40" : "border-slate-200 hover:border-blue-400 bg-white"}`
                }`}>
                {loadingClothes ? (
                  <div className="animate-pulse flex gap-4 w-full items-center">
                    <div className={`w-14 h-14 rounded-xl ${dark ? "bg-slate-800" : "bg-slate-200"}`} />
                    <div className="space-y-2 flex-1">
                      <div className={`h-3 w-32 rounded ${dark ? "bg-slate-800" : "bg-slate-200"}`} />
                      <div className={`h-2 w-20 rounded ${dark ? "bg-slate-800" : "bg-slate-200"}`} />
                    </div>
                  </div>
                ) : selectedProduct ? (
                  <>
                    <div className={`w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden ${dark ? "bg-white/10" : "bg-white"}`}>
                      <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain p-1" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-widest truncate">{selectedProduct.name}</p>
                      {selectedProduct.brand && <p className="text-[9px] opacity-40 uppercase mt-1">{selectedProduct.brand}</p>}
                    </div>
                    <span className="text-[9px] opacity-40 font-bold flex-shrink-0">Change →</span>
                  </>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${dark ? "bg-slate-800" : "bg-slate-100"}`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
                        <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
                      </svg>
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest opacity-50">Select a Garment</p>
                  </div>
                )}
              </button>
            </div>

            <button onClick={handleTryOn} disabled={loading || !personFile || !selectedProduct}
              className={`w-full py-7 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[1.5em] transition-all transform active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed ${dark ? "bg-white text-black hover:bg-blue-50" : "bg-slate-900 text-white hover:bg-black"}`}>
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
                  Processing…
                </span>
              ) : "Generate Look"}
            </button>

            {error && (
              <div className={`p-4 rounded-2xl text-xs font-semibold text-center ${dark ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-100"}`}>
                {error}
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-12 space-y-5">
            <div className={`relative aspect-[3/4] w-full rounded-[3rem] border-2 transition-all duration-700 overflow-hidden ${dark ? "bg-slate-900/60 border-white/5" : "bg-white border-slate-100 shadow-xl"}`}>
              {loading && <ProgressOverlay stepIndex={stepIndex} progress={progress} dark={dark} />}
              {resultImage ? (
                <img src={resultImage} alt="Try-on result" className="w-full h-full object-cover" style={{ animation: "fadeUp 0.6s ease" }} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-8 opacity-10">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
                  </svg>
                  <p className="text-[9px] font-black uppercase tracking-[2em]">Your look</p>
                </div>
              )}
              {resultImage && !loading && (
                <a href={resultImage} download="my-look.jpg"
                  className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-all" title="Download">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                </a>
              )}
            </div>

            {roomId && (
              <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${dark ? "bg-blue-500/5 border border-blue-500/10 text-blue-400" : "bg-blue-50 border border-blue-100 text-blue-600"}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block mr-2 animate-pulse" />
                Room {roomId} — {roomMembers} {roomMembers === 1 ? "member" : "members"} online
              </div>
            )}
          </div>
        </div>
      </div>

      {pickerOpen    && <GarmentPicker clothes={clothes} selectedProduct={selectedProduct} onSelect={setSelectedProduct} onClose={() => setPickerOpen(false)} dark={dark} />}
      {showRoomModal && <JoinRoomModal onClose={() => setShowRoomModal(false)} onJoin={handleJoinRoom} onCreate={handleCreateRoom} dark={dark} />}
    </div>
  );
}