#!/bin/bash
# Termux startup script for catchtwo

echo "Installing dependencies..."
npm install

echo "Starting bot..."
node index.js
