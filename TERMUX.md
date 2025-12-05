# Termux Setup for catchtwo

## One-time Setup
```bash
# Install Node.js
pkg update && pkg upgrade
pkg install nodejs

# Clone the repo
git clone https://github.com/YOUR_USERNAME/catchtwo-remote.git
cd catchtwo-remote

# Create tokens file
echo "YOUR_DISCORD_TOKEN" > tokens.txt

# Create config file (copy from config.example.json and edit)
cp config.example.json config.json
nano config.json
```

## Running
```bash
chmod +x start.sh
./start.sh
```

Or manually:
```bash
npm install
node index.js
```

## Keep Running in Background
```bash
# Install termux-services
pkg install termux-services

# Or use nohup
nohup node index.js &
```

## Tips
- Use `termux-wake-lock` to prevent Android from killing the process
- Run `termux-battery-status` to check battery
