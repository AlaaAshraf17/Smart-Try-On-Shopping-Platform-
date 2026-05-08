const express = require('express');
const router = express.Router();
const { authUser, registerUser, getUserProfile, updateUserProfile, getUsers, deleteUser, deleteUserProfile, authGoogleUser } = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');
const { sendContactEmail }  = require('../controllers/contactController')

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Register user
 *     tags: [Users]
 *     responses:
 *       201:
 *         description: Success
 *   get:
 *     summary: List users (Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *
 * /api/users/login:
 *   post:
 *     summary: Login user
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Success
 *
 * /api/users/contact:
 *   post:
 *     summary: Send contact email
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               message:
 *                  type: string
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       500:
 *         description: Failed to send email
 *
 * /api/users/google:
 *   post:
 *     summary: Google Authentication
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *
 * /api/users/profile:
 *   get:
 *     summary: Get profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *   put:
 *     summary: Update profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *   delete:
 *     summary: Delete own profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.route('/').post(registerUser).get(protect, admin, getUsers);
router.post('/login', authUser);
router.post('/contact', sendContactEmail);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile).delete(protect, deleteUserProfile);
router.route('/:id').delete(protect, admin, deleteUser);
router.post('/google', authGoogleUser);

module.exports = router;