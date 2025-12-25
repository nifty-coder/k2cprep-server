require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
// Middleware
// Middleware
const allowedOrigins = [
    'https://k2cprep.com',
    'https://www.k2cprep.com',
    "https://k2cprep-website.web.app",
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.indexOf(origin) !== -1 ||
            origin.endsWith('.onrender.com');

        if (isAllowed) {
            return callback(null, true);
        } else {
            console.error(`CORS blocked for origin: ${origin}`);
            return callback(new Error('Not allowed by CORS'), false);
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());

const createTransporter = async () => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error("Missing SMTP_USER or SMTP_PASS in environment variables");
            return null;
        }

        const transporter = nodemailer.createTransport({
            host: "mail.smtp2go.com",
            port: 2525, // Standard SMTP port, often works better on cloud platforms than 465
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000
        });

        return transporter;
    } catch (error) {
        console.log("Error creating transporter:", error);
        return null;
    }
};

// Routes
app.get('/', (req, res) => {
    res.send('Hello World! Server is running.');
});

app.post('/api/contact', async (req, res) => {
    const { name, email, phone, program, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    const transporter = await createTransporter();

    if (!transporter) {
        return res.status(500).json({ status: "error", message: "Failed to create email transporter" });
    }

    // Email to K2C (notification)
    const notificationMailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.RECEIVER_EMAIL || 'info@k2cprep.com',
        subject: `New Contact Form Submission from ${name} - ${program}`,
        text: `
      Name: ${name}
      Email: ${email}
      Phone: ${phone}
      Program Interest: ${program}
      
      Message:
      ${message}
    `,
        html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Program Interest:</strong> ${program}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `,
        replyTo: email
    };

    // Email to user (confirmation)
    const confirmationMailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Thank you for contacting K2C Prep!',
        text: `Hi ${name},
        
    Thank you for reaching out to K2C Prep! We have received your inquiry about ${program}.
        
    We will review your message and get back to you as soon as possible.
        
    Best regards,
    K2C Prep Team
    `,
        replyTo: process.env.RECEIVER_EMAIL || 'info@k2cprep.com'
    };

    try {
        // Send notification email to K2C
        await transporter.sendMail(notificationMailOptions);

        // Send confirmation email to user
        await transporter.sendMail(confirmationMailOptions);

        res.status(200).json({ status: "success", message: "Email sent successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ status: "error", message: "Failed to send email" });
    }
});

app.post('/api/validate-email', async (req, res) => {
    const { email } = req.body;
    const apiKey = process.env.ABSTRACT_API_KEY;

    if (!apiKey) {
        console.error("ABSTRACT_API_KEY is missing in server environment");
        return res.json({ valid: true });
    }

    try {
        const response = await axios.get(`https://emailreputation.abstractapi.com/v1/?api_key=${apiKey}&email=${email}`, {
            timeout: 10000 // 10 second timeout
        });
        const data = response.data;

        if (data.email_deliverability?.status === "undeliverable") {
            return res.json({ valid: false, message: "This email domain does not exist or cannot receive emails." });
        } else if (data.email_quality?.is_disposable === true) {
            return res.json({ valid: false, message: "Please use a permanent email address (no disposable emails)." });
        } else {
            return res.json({ valid: true });
        }
    } catch (error) {
        console.error("Email validation API error (timeout or failure):", error.message);
        // If timeout or any other error occurs, assume email is valid to avoid blocking the user
        return res.json({ valid: true });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
