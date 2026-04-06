#!/bin/bash
cd functions
npm run build
firebase deploy --only functions:editImage --non-interactive --project indiios-v-1-1
