require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
// Middleware
// Middleware
const allowedOrigins = ['https://k2cprep.com', 'https://www.k2cprep.com', 'http://localhost:5173'];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// OAuth2 Client Setup
const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
    try {
        const oauth2Client = new OAuth2(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.REDIRECT_URI || "https://developers.google.com/oauthplayground"
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.REFRESH_TOKEN
        });

        const accessToken = await new Promise((resolve, reject) => {
            oauth2Client.getAccessToken((err, token) => {
                if (err) {
                    reject("Failed to create access token :(");
                }
                resolve(token);
            });
        });

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: process.env.EMAIL_USER,
                accessToken,
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN
            }
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

    const mailOptions = {
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

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ status: "success", message: "Email sent successfully" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ status: "error", message: "Failed to send email" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
