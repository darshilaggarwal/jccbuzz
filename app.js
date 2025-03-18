// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const dotenv = require('dotenv');
const path = require('path');
const flash = require('connect-flash');
const nodemailer = require('nodemailer');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Contact form route - place it after the middleware setup
app.post('/api/contact', async (req, res) => {
    console.log('==== Contact form route triggered ====');
    console.log('Request body:', req.body);
    
    try {
        const { name, email, subject, message } = req.body;
        
        console.log('Contact form submission received:', { name, email, subject });
        
        // Email validation
        if (!name || !email || !subject || !message) {
            console.log('Validation failed: Missing required fields');
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        
        // Use existing OTP email configuration
        const EMAIL_USER = process.env.EMAIL_USER;
        const EMAIL_PASS = process.env.EMAIL_PASSWORD;
        const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'gmail';
        
        console.log('Using email configuration:', { 
            service: EMAIL_SERVICE, 
            user: EMAIL_USER, 
            pass: EMAIL_PASS ? '**PASSWORD PROVIDED**' : '**PASSWORD MISSING**'
        });
        
        // Special handling for Gmail
        let transportConfig;
        if (EMAIL_SERVICE.toLowerCase() === 'gmail') {
            transportConfig = {
                host: 'smtp.gmail.com',
                port: 465,
                secure: true, // use SSL
                auth: {
                    user: EMAIL_USER,
                    pass: EMAIL_PASS
                },
                debug: true,
                logger: true
            };
        } else {
            transportConfig = {
                service: EMAIL_SERVICE,
                auth: {
                    user: EMAIL_USER,
                    pass: EMAIL_PASS
                },
                debug: true
            };
        }
        
        console.log('Creating transporter with config:', JSON.stringify({
            service: transportConfig.service,
            debug: transportConfig.debug,
            auth: { user: transportConfig.auth.user, pass: '********' }
        }));
        
        // Set up email transporter with existing credentials
        const transporter = nodemailer.createTransport(transportConfig);
        
        // Verify connection configuration
        transporter.verify(function(error, success) {
            if (error) {
                console.error('SMTP verification failed:', error);
            } else {
                console.log('SMTP server is ready to take our messages');
            }
        });
        
        // Email content
        const mailOptions = {
            from: `"JCCbuzz Contact Form" <${EMAIL_USER}>`,
            to: EMAIL_USER, // Send to yourself (admin)
            subject: `JCCbuzz Contact Form: ${subject}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `
        };
        
        console.log('Attempting to send email to:', EMAIL_USER);
        console.log('Mail options:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject
        });
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        console.log('Email response:', info.response);
        
        res.status(200).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error sending contact form email:', error);
        console.error('Error stack:', error.stack);
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send message. Please try again later.',
            error: error.message
        });
    }
});

// Landing page route
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/feed');
    }
    res.render('landing', { isLandingPage: true });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available routes:');
    console.log('- GET /');
    console.log('- POST /api/contact');
}); 