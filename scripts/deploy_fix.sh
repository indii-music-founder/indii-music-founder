#!/bin/bash
cd functions || exit
npm run build
firebase deploy --only functions:editImage --non-interactive --project indii-v-1-1
