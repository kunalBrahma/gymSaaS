#!/bin/bash

echo "Cleaning .next, node_modules, and lock files..."
rm -rf .next node_modules package-lock.json yarn.lock

echo "Installing dependencies..."
npm install

echo "Building project..."
npm run build

echo "Done. You can now run 'npm start' or 'npm run dev'."
