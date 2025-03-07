# Google OAuth Setup Guide

## Step 1: Create a Project in Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top and select "New Project"
3. Enter a name for your project and click "Create"

## Step 2: Configure the OAuth Consent Screen
1. In your new project, go to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type (unless you have a Google Workspace account)
3. Fill in the required fields:
   - App name: "Pinspire"
   - User support email: Your email
   - Developer contact information: Your email
4. Click "Save and Continue"
5. Under "Scopes", add the following scopes:
   - `email`
   - `profile`
   - `openid`
6. Click "Save and Continue"
7. Add test users if needed, then click "Save and Continue"
8. Review your settings and click "Back to Dashboard"

## Step 3: Create OAuth Credentials
1. In the left sidebar, click on "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Enter a name for your OAuth client
5. Under "Authorized JavaScript origins", add:
   ```
   http://localhost:3000
   ```
6. Under "Authorized redirect URIs", add:
   ```
   http://localhost:3000/auth/google/callback
   ```
7. Click "Create"
8. You'll see a popup with your Client ID and Client Secret. Click the download icon to download a JSON file with your credentials.

## Step 4: Set Up Environment Variables
1. Open your `.env` file in the root of your project
2. Add the following variables with the values from the downloaded JSON:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

## Step 5: Restart Your Application
1. Save the `.env` file
2. Restart your application

## Troubleshooting
- If you get an error that says "OAuth client was not found", double-check your Client ID and Client Secret in the `.env` file
- Make sure your redirect URI exactly matches what you configured in the Google Cloud Console
- If you get an "invalid_request" error, make sure your application is using HTTPS if required by your Google OAuth settings
- Check the server logs for more detailed error information

## Additional Resources
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Passport.js Google OAuth 2.0 Strategy](http://www.passportjs.org/packages/passport-google-oauth20/) 