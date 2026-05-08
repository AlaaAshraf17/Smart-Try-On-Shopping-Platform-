const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User')

const addOrderItems = asyncHandler(async (req, res) => {
    const {
        orderItems,
        shippingAddress,
        paymentMethod,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
    } = req.body;

    if (orderItems && orderItems.length === 0) {
        res.status(400);
        throw new Error('No order items');
    } else {
        const order = new Order({
            orderItems,
            user: req.user._id,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
        });

        const createdOrder = await order.save();

        for (const item of orderItems) {
            const product = await Product.findById(item.product);
            if (product) {
                product.countInStock -= item.qty;
                await product.save();

                if (product.countInStock === 0) {
                    global.io.emit('inventory_alert', {
                        type: 'SOLD_OUT',
                        message: `High Demand! ${product.name} just sold out!`,
                        productId: product._id
                    });
                } else if (product.countInStock < 5) {
                    global.io.emit('inventory_alert', {
                        type: 'LOW_STOCK',
                        message: `Only ${product.countInStock} left of ${product.name}!`,
                        productId: product._id
                    });
                }
            }
        }

        global.io.emit('admin:newOrder', {
            orderId: createdOrder._id,
            totalPrice: createdOrder.totalPrice
        });

        res.status(201).json(createdOrder);
    }
});

const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (order) {
        res.json(order);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
});

const getOrderSummary = asyncHandler(async (req, res) => {
    const orders = await Order.aggregate([
        {
            $group: {
                _id: null,
                totalSales: { $sum: '$totalPrice' },
                numOrders: { $sum: 1 },
            },
        },
    ]);

    const userCount = await User.countDocuments();
    const productCount = await Product.countDocuments();

    res.json({
        totalSales: orders.length > 0 ? orders[0].totalSales : 0,
        numOrders: orders.length > 0 ? orders[0].numOrders : 0,
        userCount,
        productCount
    });
});

const updateOrderToPaid = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
        order.isPaid = true;
        order.paidAt = Date.now();
        const updatedOrder = await order.save();

        global.io.emit('admin:revenueUpdate', {
            amount: updatedOrder.totalPrice,
            timestamp: updatedOrder.paidAt
        });

        res.json(updatedOrder);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

const updateOrderToDeliver = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
        order.isDelivered = true;
        order.deliveredAt = Date.now();
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

const getAllOrders = asyncHandler (async (req, res) => {
    try {
        const orders = await Order.find({}).populate('user', 'id name email');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Server Error fetching orders" });
    }
});

module.exports = { addOrderItems, getOrderById, getMyOrders, getOrderSummary, updateOrderToPaid, updateOrderToDeliver, getAllOrders };