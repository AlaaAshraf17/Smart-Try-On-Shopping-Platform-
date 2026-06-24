const express = require("express");
const router = express.Router();
const { handleChatStream } = require("../controllers/chatController");

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Dispatch user query to Virtual Fashion Assistant
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - message
 *               - chatHistory
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "65f8a12b4f9e4c001f3e7b89"
 *                 description: The unique MongoDB object ID of the authenticated user.
 *               message:
 *                 type: string
 *                 example: "What formal suit matches my profile?"
 *                 description: The plain text query message sent from the client UI.
 *               chatHistory:
 *                 type: array
 *                 description: Multi-turn conversation logs maintained for dialogue context.
 *                 items:
 *                   type: object
 *                   required:
 *                     - role
 *                     - parts
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, model]
 *                       example: "user"
 *                     parts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - text
 *                         properties:
 *                           text:
 *                             type: string
 *                             example: "Hello!"
 *     responses:
 *       200:
 *         description: Successful execution of the conversational pipeline.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *                   example: "Based on your style profile, a slim-fit dark blazer would look fantastic. Tap the try-on button to see it!"
 *       400:
 *         description: Bad request parameters or missing fields.
 *       500:
 *         description: Chatbot pipeline execution failed.
 */
router.post("/", handleChatStream);

module.exports = router;