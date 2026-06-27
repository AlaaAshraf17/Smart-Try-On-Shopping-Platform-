"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import "./Chatbot.css";

const ChatbotWidget = () => {
    const { user, loading } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory, isLoading]);

    if(loading || !user) return null;

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        const currentMessage = message;
        setMessage("");

        const updatedHistory = [...chatHistory, { role: "user", parts: [{ text: currentMessage }] }];
        setChatHistory(updatedHistory);
        setIsLoading(true);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user._id,
                    message: currentMessage,
                    chatHistory: chatHistory
                })
            });

            const data = await response.json();

            if (response.ok) {
                setChatHistory([
                    ...updatedHistory,
                    { role: "model", parts: [{ text: data.reply }] }
                ]);
            } else {
                setChatHistory([
                    ...updatedHistory,
                    { role: "model", parts: [{ text: "Sorry, I am facing an issue loading your style profile right now." }] }
                ]);
            }
        } catch (error) {
            console.error("Chatbot frontend error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chatbot-wrapper">
            <button className="chat-trigger-btn" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? "✕" : "💬 Ask Virtual Stylist"}
            </button>

            {isOpen && (
                <div className="chat-window-box">
                    <div className="chat-header-bar">
                        <h3>Virtual AI Assistant</h3>
                        <span>Powered by Gemini</span>
                    </div>

                    <div className="chat-messages-container">
                        {chatHistory.length === 0 && (
                            <p className="empty-chat-tip">
                                Hello! Ask me anything about our clothing items, or let me know your style preferences to locate the perfect fit.
                            </p>
                        )}
                        {chatHistory.map((turn, index) => (
                            <div key={index} className={`message-row ${turn.role}`}>
                                <div className="message-bubble">
                                    {turn.parts[0].text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message-row model">
                                <div className="message-bubble loading-dots">Stylist is thinking...</div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            placeholder="Type a dress code, item style, or sizing query..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading}>Send</button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ChatbotWidget;