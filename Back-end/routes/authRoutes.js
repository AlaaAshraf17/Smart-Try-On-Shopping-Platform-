const express = require("express");
const router = express.Router();
const { forgotPassword } = require("../controllers/authController");

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Initiate password recovery email dispatch
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: "kareem@example.com"
 *                 description: The user's registered email address to send the reset token link.
 *     responses:
 *       200:
 *         description: Secure reset link dispatched to your email.
 *       404:
 *         description: No account found with this email address.
 *       500:
 *         description: Failed to dispatch email helper.
 */
router.post("/forgot-password", forgotPassword);

module.exports = router;