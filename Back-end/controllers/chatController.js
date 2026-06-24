const { GoogleGenAI } = require("@google/genai");
const User = require("../models/User");
const Product = require("../models/Product");

exports.handleChatStream = async (req, res) => {
    try {
        const { userId, message, chatHistory } = req.body;

        const userProfile = await User.findById(userId);
        const physicalContext = userProfile
            ? `User Metrics: Height ${userProfile.height}cm, Weight ${userProfile.weight}kg.`
            : "User sizing profile not initialized yet.";

        const systemInstruction = `You are the specialized Virtual Fashion Assistant for the Smart Try-On Platform. 
        Your job is to recommend clothing and accessories using the user's physical attributes. 
        Be concise, stylish, helpful, and polite. ${physicalContext}`;

        const aiProvider = new GoogleGenAI({ apiKey: process.env.AI_API_KEY });
        const response = await aiProvider.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [...chatHistory, { role: "user", parts: [{ text: message }] }],
            config: { systemInstruction }
        });

        return res.status(200).json({ reply: response.text });
    } catch (error) {
        return res.status(500).json({ error: "Chatbot pipeline execution failed." });
    }
};