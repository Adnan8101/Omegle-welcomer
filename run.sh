#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# App name
APP_NAME="omeglee-welcomer"
MAIN_FILE="dist/index.js"

echo -e "${YELLOW}Starting Omeglee Welcomer deployment...${NC}"

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}pm2 not found. Installing globally...${NC}"
    npm install -g pm2
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Compile TypeScript
echo -e "${YELLOW}Compiling TypeScript...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}Build successful!${NC}"

# Check if process already exists
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    echo -e "${YELLOW}Process '$APP_NAME' already exists. Restarting...${NC}"
    pm2 restart "$APP_NAME"
else
    echo -e "${YELLOW}Process '$APP_NAME' does not exist. Creating new process...${NC}"
    pm2 start "$MAIN_FILE" --name "$APP_NAME"
fi

# Save PM2 configuration
pm2 save

echo -e "${GREEN}✓ Omeglee Welcomer is now running on pm2!${NC}"
echo -e "${GREEN}✓ To view logs: pm2 logs $APP_NAME${NC}"
echo -e "${GREEN}✓ To stop: pm2 stop $APP_NAME${NC}"
echo -e "${GREEN}✓ To restart: pm2 restart $APP_NAME${NC}"
