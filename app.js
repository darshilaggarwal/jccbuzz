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

// Contact form route
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        
        console.log('Contact form submission received:', { name, email, subject });
        
        // Email validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        
        // Use existing OTP email configuration
        const EMAIL_USER = process.env.EMAIL_USER;
        const EMAIL_PASS = process.env.EMAIL_PASSWORD;
        const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'gmail';
        
        console.log('Using email configuration:', { 
            service: EMAIL_SERVICE, 
            user: EMAIL_USER, 
            pass: EMAIL_PASS ? '**REDACTED**' : 'Not configured'
        });
        
        // Set up email transporter with existing credentials
        const transporter = nodemailer.createTransport({
            service: EMAIL_SERVICE,
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS
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
        
        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        
        res.status(200).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error sending contact form email:', error);
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