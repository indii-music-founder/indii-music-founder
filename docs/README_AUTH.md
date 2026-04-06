# Authentication Setup Guide

To properly configure Firebase Authentication for Indii OS, follow these steps:

## Prerequisites

- A Firebase project established at [Firebase Console](https://console.firebase.google.com/).

## Environment Variables

Create or update your `.env` (or `.env.local`) file in the root directory with the following variable:

```bash
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
```

### How to find your Firebase API Key

1. Go to your [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. Click on the gear icon (Project Settings).
4. Under the "General" tab, you will see your "Web API Key".

## Security Note
>
> [!IMPORTANT]
> Never commit your `.env` file to version control. It is already included in `.gitignore`.

## Production Deployments

When deploying to production (e.g., Firebase Hosting, Vercel), ensure that `VITE_FIREBASE_API_KEY` is added to your environment variables in the deployment platform's dashboard.
