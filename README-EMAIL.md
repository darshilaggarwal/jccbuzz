# Pinspire Email Configuration Guide

This guide helps you set up email sending for the OTP verification system in Pinspire.

## Current Configuration

The application is configured to use SMTP with the following settings:

- **Email Provider**: Zoho Mail (for darshil.site domain)
- **SMTP Server**: smtp.zoho.com
- **Port**: 465 (SSL)
- **Email**: hi@darshil.site
- **Authentication**: Password-based

## Troubleshooting Email Sending

If emails are not being sent, please check the following:

### 1. Verify Credentials

Make sure your .env file contains the correct credentials:

```
EMAIL_USER=hi@darshil.site
EMAIL_PASSWORD=your_correct_password
NODE_ENV=production
```

### 2. Zoho Mail Settings

For Zoho Mail (darshil.site), ensure:

- IMAP Access is enabled in your Zoho Mail settings
- If you have 2FA enabled, use an App Password instead of your regular password
- Your account is active and in good standing
- The App Password has appropriate permissions

### 3. Testing Email Sending

Run the test script to verify your email configuration:

```bash
node scripts/testEmail.js
```

This will attempt to send a test email using your current configuration.

### 4. Common Error Messages

- **Authentication failed**: Check your password and ensure you're using an App Password if 2FA is enabled
- **Connection refused**: Check if the SMTP server host and port are correct
- **Rate limit exceeded**: You might be sending too many emails in a short period

### 5. Custom Domain Considerations

For custom domains like darshil.site:

- Verify your domain has proper MX records set up
- Ensure your email hosting provider allows SMTP access
- Check if there are any outbound restrictions

## Modifying Email Configuration

If you need to use a different email provider, update the emailSender.js file with the appropriate SMTP configuration for your provider.

For Gmail:
```javascript
transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});
```

For Office 365:
```javascript
transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});
```

## Testing in Development Mode

In development mode (NODE_ENV=development), emails are not actually sent. Instead, the OTP is:

1. Logged to the console
2. Returned in the API response as `dev_otp`
3. Displayed on the registration page

This makes testing easier without having to send real emails. 