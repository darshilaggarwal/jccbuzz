// Utility for sending OTP emails
const nodemailer = require('nodemailer');

// Create a transporter for sending emails
let transporter;

// Initialize email transporter based on environment
function initializeTransporter() {
    // Always initialize the email transporter for sending, regardless of environment
    console.log('Initializing email transporter');
    
    // Custom SMTP configuration for darshil.site domain
    const domain = process.env.EMAIL_USER ? process.env.EMAIL_USER.split('@')[1] : '';
    console.log(`Setting up SMTP for domain: ${domain}`);
    
    // Configuration specifically for darshil.site
    if (domain === 'darshil.site') {
        console.log('Using dedicated configuration for darshil.site');
        transporter = nodemailer.createTransport({
            host: 'smtp.zoho.com',  // Zoho Mail SMTP server for custom domains
            port: 465,
            secure: true,  // Use SSL
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    } 
    // Gmail configuration
    else if (domain === 'gmail.com') {
        console.log('Using Gmail configuration');
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }
    // Generic configuration for other domains
    else {
        console.log('Using generic SMTP configuration');
        transporter = nodemailer.createTransport({
            host: domain ? `mail.${domain}` : 'localhost',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }
    
    // Verify connection configuration
    transporter.verify(function(error, success) {
        if (error) {
            console.error('Email transporter verification failed:', error);
            console.error('Please check your email provider settings');
        } else {
            console.log('Email server is ready to send messages');
        }
    });
}

// Initialize the transporter when this module is loaded
initializeTransporter();

// Function to send OTP email
async function sendOTPEmail(to, otp, name) {
    try {
        // Always attempt to send the email, but log it in development mode as a backup
        if (process.env.NODE_ENV !== 'production') {
            console.log('==================== DEVELOPMENT EMAIL ====================');
            console.log(`To: ${to}`);
            console.log(`Subject: JCCbuzz Registration: Your OTP Code`);
            console.log(`OTP for ${name}: ${otp}`);
            console.log('==========================================================');
        }
        
        // Log sending attempt (will be useful for debugging)
        console.log(`Attempting to send OTP email to: ${to}`);
        
        // Define email options
        const mailOptions = {
            from: `"JCCbuzz Verification" <${process.env.EMAIL_USER || 'noreply@jccbuzz.edu'}>`,
            to: to,
            subject: 'JCCbuzz Registration: Your OTP Code',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #4f46e5;">JCCbuzz</h1>
                </div>
                <p>Hello,</p>
                <p>Thank you for registering with JCCbuzz. Your verification code is:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <div style="font-size: 24px; font-weight: bold; letter-spacing: 5px; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">${otp}</div>
                </div>
                <p>This code will expire in 2 minutes.</p>
                <p>If you did not request this code, please ignore this email.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #777; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} JCCbuzz. All rights reserved.
                </div>
            </div>
            `,
            text: `Your JCCbuzz verification code is: ${otp}. This code will expire in 2 minutes.`
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('OTP Email sent successfully to', to);
        if (info && info.messageId) {
            console.log('Message ID:', info.messageId);
        }
        return true;
    } catch (error) {
        console.error('Error sending OTP email to', to, ':', error);
        
        // For darshil.site specifically, provide focused troubleshooting
        if (process.env.EMAIL_USER && process.env.EMAIL_USER.includes('darshil.site')) {
            console.error('\nEmail sending for darshil.site failed. Please check:');
            console.error('1. Confirm your Zoho Mail credentials are correct');
            console.error('2. Verify that POP/IMAP access is enabled in your Zoho Mail account');
            console.error('3. Check if you need to create an App Password in Zoho Mail');
            console.error('4. Make sure your email account is active');
        } 
        // Generic advice for other providers
        else {
            console.error('\nEmail sending failed. Please check:');
            console.error('1. Your email credentials in the .env file');
            console.error('2. Your email provider\'s SMTP settings');
            console.error('3. If you need to enable "Less secure app access" or create an App Password');
        }
        
        return false;
    }
}

module.exports = {
    sendOTPEmail,
    initializeTransporter
}; 