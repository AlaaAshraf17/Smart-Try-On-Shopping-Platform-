const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "No account found with this email address." });
        }

        const tempPassword = crypto.randomBytes(4).toString("hex");

        user.password = tempPassword;

        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: `"Fit-Me Support" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Your Temporary Fit-Me Password",
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #0f172a;">
                    <h3>Hello ${user.name},</h3>
                    <p>We have updated your profile with a temporary access key as requested.</p>
                    <p>Use the following password credentials to access your account immediately on our login form:</p>
                    <div style="background: #f1f5f9; padding: 15px; font-size: 18px; font-weight: bold; tracking-content: 2px; text-align: center; border-radius: 8px; margin: 20px 0; color: #0f172a; border: 1px dashed #cbd5e1;">
                        ${tempPassword}
                    </div>
                    <p style="color: #64748b; font-size: 13px;">For security, we highly recommend changing this temporary string to a custom password from your profile settings dashboard once you log in successfully.</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: "Temporary account password dispatched to your email." });

    } catch (error) {
        console.error("CRITICAL SMTP ERROR:", error);
        return res.status(500).json({ message: "Failed to dispatch email helper." });
    }
};