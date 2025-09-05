# Debug Setup Instructions

## ✅ Debug Configuration Complete

Both server and client are now properly configured for debugging in the pnpm monorepo setup.

## 🚀 How to Start Debugging

### Recommended Approach: Terminal + Attach
1. **Start API in debug mode** (in terminal):
   ```bash
   cd apps/api && pnpm run debug
   ```

2. **Attach debugger** (in VSCode):
   - Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac)
   - Select **"Attach to NestJS API"**
   - Click the green play button or press `F5`

### Alternative: VSCode Options

**Launch Configurations (Debug Panel):**
- **"Launch NestJS API (Direct - Fallback)"** - Direct TypeScript execution with ts-node
- **"Debug Full Stack (Attach Mode)"** - Attach to running API only

**VSCode Tasks (Recommended for UI):**
- **"Start Frontend"** - Start the Next.js UI using pnpm (avoids debugging issues)
- **"Start API (Debug Ready)"** - Start API in debug mode, ready for attachment
- **"Start API (No Debug)"** - Start API without debugging

To run tasks: `Ctrl+Shift+P` → "Tasks: Run Task" → Select task

### Option 3: Terminal Commands Only
```bash
# API Debug Mode
cd apps/api && pnpm run debug

# Frontend Dev Mode
cd apps/web && pnpm run dev
```

## 🔧 Debug Configurations

### 1. Attach to NestJS API (Primary Method)
- **Type**: Attach to running process
- **Port**: 9229
- **Usage**: Start API with `pnpm run debug` first, then attach
- **Benefits**: Most reliable, avoids VSCode flag conflicts, no automatic debugger attachment

### 2. Launch NestJS API (Direct - Fallback)
- **Type**: Direct TypeScript execution
- **Runtime**: Node.js with ts-node
- **Usage**: One-click launch from VSCode (fallback only)
- **Benefits**: Direct debugging without compilation

### 3. Debug Full Stack (Attach Mode)
- **Type**: Compound configuration
- **Usage**: Attaches to running API process
- **Benefits**: Clean separation of concerns, debugger only when needed

## 🛠️ VSCode Tasks (Recommended for UI)

### 1. Start Frontend
- **Command**: `pnpm run dev` in apps/web
- **Usage**: `Ctrl+Shift+P` → "Tasks: Run Task" → "Start Frontend"
- **Benefits**: Avoids VSCode debugging flag issues, clean UI startup

### 2. Start API (Debug Ready)
- **Command**: `pnpm run debug` in apps/api
- **Usage**: `Ctrl+Shift+P` → "Tasks: Run Task" → "Start API (Debug Ready)"
- **Benefits**: Starts API ready for debugger attachment

### 3. Start API (No Debug)
- **Command**: `pnpm run dev` in apps/api
- **Usage**: `Ctrl+Shift+P` → "Tasks: Run Task" → "Start API (No Debug)"
- **Benefits**: Starts API without debugging capabilities

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
