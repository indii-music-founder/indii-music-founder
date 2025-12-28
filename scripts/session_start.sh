#!/bin/bash
echo "🧹 Cleaning environment..."
# Ensure dependencies are installed and types are generated
npm install
npm run generate-types
echo "Environment ready."
