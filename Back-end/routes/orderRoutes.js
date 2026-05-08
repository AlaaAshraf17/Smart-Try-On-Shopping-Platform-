const express = require('express');
const router = express.Router();
const { addOrderItems, getOrderById, getMyOrders, getOrderSummary, updateOrderToDeliver, updateOrderToPaid,
    getAllOrders
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created
 *
 * /api/orders/summary:
 *   get:
 *     summary: Admin stats
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *
 * /api/orders/myorders:
 *   get:
 *     summary: User orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *
 * /api/orders/{id}:
 *   get:
 *     summary: Order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *
 * /api/orders/{id}/pay:
 *   put:
 *     summary: Mark order as paid
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paid
 * /api/orders/{id}/deliver:
 *   put:
 *     summary: Mark order as delivered (Admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivered
 * /api/orders/all:
 *   get:
 *     summary: Get all orders (Admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     response:
 *       200:
 *         description: Success
 */
router.route('/').post(protect, addOrderItems);
router.route('/summary').get(protect, admin, getOrderSummary);
router.route('/myorders').get(protect, getMyOrders);
router.route('/all').get(protect, admin, getAllOrders);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/pay').put(protect, updateOrderToPaid);
router.route('/:id/deliver').put(protect, admin, updateOrderToDeliver);

module.exports = router;