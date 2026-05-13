require('dotenv').config();

// import roomRoutes from "./routes/roomRoutes.js";
const roomRoutes = require('./routes/roomRoutes');
const express = require('express');
const connectDB = require('./config/db');
const colors = require('colors');
const path = require('path');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const morgan = require('morgan');
const os = require('os-utils');

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err.message);
});
console.log('🔍 Debug: Starting server initialization');
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
console.log('MONGO_URI first chars:', process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 20) + '...' : 'not set');

let dbConnected = false;
let activeRequests = 0;

if (process.env.NODE_ENV !== 'test') {
    connectDB()
        .then(() => {
            dbConnected = true;
            console.log('✅ Database connected successfully');
        })
        .catch(err => {
            console.error('❌ Database connection failed:', err);
            dbConnected = false;
        });
}

const app = express();
const http = require("http").createServer(app);

const io = require("socket.io")(http, {
  cors: {
      origin: process.env.NODE_ENV === 'production'
          ? "https://frontend.vercel.app"
          : "http://localhost:3000",
      methods: ["GET", "POST"]
  }
});

global.io = io;

setInterval(() => {
    os.cpuUsage((v) => {
        io.emit("admin:serverStats", {
            cpu: (v * 100).toFixed(2),
            ram: (100 - (os.freememPercentage() * 100)).toFixed(2),
            uptime: Math.floor(os.sysUptime() / 60)
        });
    });
}, 5000);

io.on("connection", (socket) => {
    console.log(`⚡ User Connected: ${socket.id}`);

    socket.on("join_session", (roomId) => {
        socket.join(roomId);
        console.log(`👥 User ${socket.id} joined room: ${roomId}`);
        
    });

    socket.on("ai_request_started", () => {
        activeRequests++;
        io.emit("admin:queueUpdate", { queueLength: activeRequests });
    });

    socket.on("ai_request_finished", () => {
        if(activeRequests > 0) activeRequests--;
        io.emit("admin:queueUpdate", { queueLength: activeRequests });
    });

    socket.on("send_feedback", (data) => {
        // data: { roomId, user, type: 'like' | 'comment', message }
        if (data.roomId) {
            socket.to(data.roomId).emit("receive_feedback", data);
        }
    });

    socket.on("disconnect", () => {
        console.log("❌ User disconnected");
    });

    // Feature -> Support Chat
    socket.on("join_chat", (userId) => {
        socket.join(userId);
        console.log(`💬 User ${userId} is now online for support`);
    });

    socket.on("send_support_message", (arg) => {
        let data = typeof arg === 'string' ? JSON.parse(arg) : arg;

        console.log('--- New Message Event ---');
        console.log('Data Received:', data);

        if (data && data.receiverId) {
            const messageData = { ...data, timestamp: new Date() };
            io.to(data.receiverId).emit("receive_support_message", messageData);
            console.log('✅ Emit command executed to room:', data.receiverId);
        } else {
            console.log('⚠️ Message ignored: Missing receiverId. Type of data is:', typeof data);
        }
    });
});


app.use(express.json());
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL || 'https://frontend.vercel.app'].filter(Boolean)
        : 'http://localhost:3000',
          credentials: true
}));

app.get('/', (req, res) => {
    res.json({
        message: 'Fitme API is running...',
        database: dbConnected ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        database: dbConnected ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/try-on', require('./routes/tryOnRoutes'));
app.use("/api/rooms", roomRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Fitme API Documentation"
}));

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

http.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`.cyan.bold);
});

module.exports = app;