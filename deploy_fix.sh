#!/bin/bash
cd functions
npm run build
firebase deploy --only functions:editImage --non-interactive --project YOUR_FIREBASE_PROJECT_ID
