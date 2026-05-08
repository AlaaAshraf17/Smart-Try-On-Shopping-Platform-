const nodemailer = require('nodemailer');

const sendContactEmail = async (req, res) => {
    const { name, email, message } = req.body;

    const transporter = nodemailer.createTransport({
        // service: 'gmail',
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.CONTACT_INBOX,
        replyTo: email,
        subject: `FitMe Support: Message from ${name}`,
        text: `You have a new message from your FitMe contact form.\n\n` +
            `User Name: ${name}\n` +
            `User Email: ${email}\n\n` +
            `Message Contents:\n${message}`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: 'Email sent!' });
    } catch (error) {
        console.error("Nodemailer error:", error);
        res.status(500).json({ success: false, message: 'Email failed to send' });
    }
};

module.exports = { sendContactEmail };