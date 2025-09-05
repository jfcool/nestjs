# Debug Setup Instructions

## ✅ Debug Configuration Complete

Both server and client are now properly configured for debugging in the pnpm monorepo setup.

## 🚀 How to Start Debugging

### Option 1: VSCode Debug Panel (Multiple Choices)
1. Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac)
2. Select from these configurations:
   - **"Attach to NestJS API"** - Attach to running debug server (most reliable)
   - **"Launch NestJS API (Direct)"** - Direct TypeScript execution with ts-node
   - **"Launch NestJS API (via pnpm)"** - Launch through pnpm (fixed flag issues)
   - **"Launch Next.js Frontend"** - Launch frontend in debug mode
   - **"Debug Full Stack (Attach Mode)"** - Attach to running API
   - **"Debug Full Stack (Launch Mode)"** - Launch both API and frontend
3. Click the green play button or press `F5`

### Option 2: Terminal + Attach (Most Reliable)
```bash
# Step 1: Start API in debug mode (terminal)
cd apps/api && pnpm run debug

# Step 2: In VSCode Debug Panel, select "Attach to NestJS API" and press F5
```

### Option 3: Terminal Commands Only
```bash
# API Debug Mode
cd apps/api && pnpm run debug

# Frontend Dev Mode
cd apps/web && pnpm run dev
```

## 🔧 Debug Configurations

### 1. Attach to NestJS API (Recommended)
- **Type**: Attach to running process
- **Port**: 9229
- **Usage**: Start API with `pnpm run debug` first, then attach
- **Benefits**: Most reliable, avoids flag conflicts

### 2. Launch NestJS API (Direct)
- **Type**: Direct TypeScript execution
- **Runtime**: Node.js with ts-node
- **Usage**: One-click launch from VSCode
- **Benefits**: Direct debugging without compilation

### 3. Launch NestJS API (via pnpm)
- **Type**: Launch through pnpm
- **Usage**: Uses your pnpm debug script
- **Benefits**: Consistent with your workflow
- **Fixed**: Removed problematic flags that caused conflicts

### 4. Launch Next.js Frontend
- **Type**: Launch through pnpm
- **Usage**: Starts frontend in debug mode
- **Benefits**: Full-stack debugging capability

### 5. Compound Configurations
- **Debug Full Stack (Attach Mode)**: Attach to running API
- **Debug Full Stack (Launch Mode)**: Launch both API and frontend

## 🔍 SAP Connection Debug Features

The enhanced logging provides:
- **Connection Details**: Masked credentials for security
- **Request URLs**: Full SAP OData endpoints
- **Error Details**: Complete stack traces
- **Debug Output**: Step-by-step connection attempts

### Example Debug Output:
```
[DEBUG] getData called with servicePath: /sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection
[DEBUG] connectionInfo: {"baseUrl":"https://your-sap-system:44301","username":"testuser","password":"***","rejectUnauthorized":false}
[LOG] [SAP] Fetching data from: https://your-sap-system:44301/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection
[ERROR] [SAP ERROR] Error details: HTTP request failed: getaddrinfo ENOTFOUND your-sap-system
```

## 🎯 Next Steps

1. **Replace placeholder URL**: Change `https://your-sap-system:44301` to your actual SAP system URL
2. **Enter valid credentials**: Use real SAP username and password
3. **Set breakpoints**: Add breakpoints in TypeScript code for step-by-step debugging
4. **Monitor logs**: Watch the enhanced debug output for connection details

## 🚨 Troubleshooting

If you encounter issues:
1. Ensure pnpm is installed and available in PATH
2. Verify both CLI binaries exist:
   - `apps/api/node_modules/.bin/nest`
   - `apps/web/node_modules/.bin/next`
3. Check that dependencies are installed: `pnpm install`
4. Restart VSCode if debug configurations don't appear

The debug setup is now fully functional and ready for SAP connection troubleshooting!
