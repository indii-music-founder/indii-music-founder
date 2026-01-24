# Distribution Transmission Guide 📡

**indiiOS Direct Distribution Engine - SFTP & Aspera Setup**

---

## 📋 Table of Contents

1. [Current Status](#current-status)
2. [SFTP Transmission (Ready)](#sftp-transmission-ready)
3. [Aspera Transmission (Setup Required)](#aspera-transmission-setup-required)
4. [Testing Procedures](#testing-procedures)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Current Status

### ✅ **SFTP - Production Ready**

- **Status**: Fully operational and tested
- **Components**: All implemented and verified
- **Requirements**: Standard SFTP server credentials only
- **Use Now**: Yes, immediately available

### ⚠️ **Aspera - Awaiting Binary**

- **Status**: Structurally complete, requires IBM Aspera Connect
- **Components**: Python script ready, IPC handler configured
- **Requirements**: IBM Aspera Connect installation needed
- **Use Now**: No, will gracefully fail without `ascp` binary

---

## SFTP Transmission (Ready) ✅

### Overview

The SFTP transmission system is **fully operational** and ready for production use. It can upload DDEX packages, ITMSP bundles, and any distribution assets to SFTP-enabled servers.

### Features

- ✅ Recursive directory uploads
- ✅ Single file uploads
- ✅ Progress tracking for large transfers
- ✅ SSH key and password authentication
- ✅ Persistent logs in `~/Library/Application Support/indii-os/`
- ✅ Real-time status updates in UI
- ✅ Automatic retry on connection failures

### How to Use (Development Mode)

1. **Start indiiOS Studio:**

   ```bash
   npm run dev
   ```

2. **Navigate to Distribution Dashboard:**
   - Click **Distribution** in the main navigation
   - Select the **Transmission** tab

3. **Configure SFTP Connection:**
   - Protocol: Select **SFTP**
   - Host: `ftp.yourprovider.com`
   - Port: `22` (default)
   - Username: Your SFTP username
   - Password: Your SFTP password (or use SSH Key)
   - Local Path: Path to your DDEX/ITMSP package
   - Remote Path: Destination directory on server

4. **Initiate Transfer:**
   - Click **Transmit Package**
   - Monitor real-time logs in the event panel
   - Success/failure notifications will appear

### Supported Workflows

- ✅ **DDEX to Distributors**: Upload DDEX packages to digital service providers
- ✅ **ITMSP to Apple**: Deliver iTunes packages to Apple Music
- ✅ **Batch Uploads**: Upload entire release directories
- ✅ **Manual QC Results**: Transfer quality control reports

---

## Aspera Transmission (Setup Required) ⚠️

### What is Aspera?

IBM Aspera is an enterprise-grade file transfer protocol designed for high-speed, reliable transmission of large media files. Many major distributors (Universal, Sony, Warner) require Aspera for DDEX delivery.

### Current Implementation Status

**What's Complete:**

- ✅ Python uploader script (`aspera_uploader.py`)
- ✅ Electron IPC handler with protocol switching
- ✅ UI component with Aspera toggle
- ✅ Type definitions and service layer

**What's Missing:**

- ❌ IBM Aspera Connect installation
- ❌ `ascp` command-line binary

### Installation Steps

#### Step 1: Download IBM Aspera Connect

**macOS:**

1. Visit: <https://www.ibm.com/aspera/connect/>
2. Click **Download for Mac**
3. Open the downloaded `.dmg` file
4. Drag **Aspera Connect** to `/Applications`

**Windows:**

1. Visit: <https://www.ibm.com/aspera/connect/>
2. Click **Download for Windows**
3. Run the installer executable
4. Follow installation prompts

#### Step 2: Verify Installation

Open Terminal (macOS) or Command Prompt (Windows) and run:

```bash
# macOS / Linux
which ascp

# Windows
where ascp
```

**Expected Output (macOS):**

```
/Applications/Aspera Connect.app/Contents/Resources/ascp
```

**Expected Output (Windows):**

```
C:\Program Files\Aspera\Aspera Connect\bin\ascp.exe
```

If the command returns "not found", proceed to Step 3.

#### Step 3: Add `ascp` to PATH (If Needed)

**macOS:**
Add this line to your `~/.zshrc` or `~/.bash_profile`:

```bash
export PATH="/Applications/Aspera Connect.app/Contents/Resources:$PATH"
```

Then reload your shell:

```bash
source ~/.zshrc  # or source ~/.bash_profile
```

**Windows:**

1. Right-click **This PC** → **Properties** → **Advanced system settings**
2. Click **Environment Variables**
3. Under **System variables**, select **Path** → **Edit**
4. Click **New** and add:

   ```
   C:\Program Files\Aspera\Aspera Connect\bin
   ```

5. Click **OK** and restart Terminal

#### Step 4: Test Aspera Integration

1. **Restart indiiOS Studio** (to pick up new PATH)
2. Navigate to **Distribution** → **Transmission**
3. Select **Aspera** protocol
4. Configure connection (host, username, etc.)
5. Click **Transmit Package**

**Success Indicator:**

- Event log shows: `"Aspera transfer initiated with ascp"`
- No error: `"ascp binary not found"`

### Aspera-Specific Configuration

When using Aspera, you may need provider-specific settings:

**Typical Aspera Config:**

- **Transfer Rate**: `-l 100M` (100 Mbps, adjust based on network)
- **Encryption**: `-m 10M` (min speed in Mbps)
- **Resume on Failure**: `-k 2` (resume level)

The indiiOS implementation **automatically handles these defaults**. Custom parameters can be added to `aspera_uploader.py` if needed.

---

## Testing Procedures 🧪

### Pre-Deployment Checklist

#### 1. SFTP Functional Test

```bash
# Create a test file
echo "IndiiOS Test Package" > /tmp/test_sftp.txt

# In indiiOS UI:
# - Protocol: SFTP
# - Host: test.rebex.net (public test server)
# - Port: 22
# - Username: demo
# - Password: password
# - Local: /tmp/test_sftp.txt
# - Remote: /upload/
```

**Expected Result**: File uploads successfully, log shows `SUCCESS`.

#### 2. Aspera Functional Test

```bash
# Verify ascp is available
ascp --version

# In indiiOS UI:
# - Protocol: Aspera
# - Host: aspera-test.example.com (your test server)
# - Username: test_user
# - Local: /path/to/test/package
# - Remote: /incoming/
```

**Expected Result**: Aspera transfer completes with high-speed metrics.

#### 3. Error Handling Test

```bash
# Test with invalid credentials
# Expected: Error message in UI + detailed log entry
```

#### 4. Large File Test

```bash
# Test with a 1GB+ DDEX package
# Expected: Progress updates in real-time, no timeout
```

### Automated Test Suite

Run the integration tests:

```bash
npm run test src/services/distribution/DistributionService.integration.test.ts
```

Expected: `7/7 tests passing`

---

## Production Deployment 🚀

### Deployment Checklist

- [ ] **Verify Python Dependencies**

  ```bash
  pip3 install paramiko  # For SFTP
  ```

- [ ] **Verify Aspera Installation** (if using Aspera)

  ```bash
  ascp --version
  ```

- [ ] **Build Production Package**

  ```bash
  npm run build:studio
  npx electron-builder --mac --publish never
  ```

- [ ] **Test Packaged App**
  - Launch the built `.app` from `dist/mac/indiiOS.app`
  - Verify SFTP transmission works
  - Verify Aspera transmission works (if installed)
  - Check logs in `~/Library/Application Support/indii-os/`

- [ ] **Configure Production Credentials**
  - Use environment variables or secure keychain for passwords
  - Rotate SSH keys regularly
  - Use distributor-provided Aspera credentials

### Security Best Practices

1. **Never hardcode credentials** - Always use runtime config
2. **Use SSH keys over passwords** - More secure for SFTP
3. **Encrypt Aspera transfers** - Use `-E MD5` flag for checksum verification
4. **Monitor transmission logs** - Check for failed transfers
5. **Implement retry logic** - Handle network interruptions gracefully

### Monitoring & Logging

All transmission logs are stored in:

```
macOS: ~/Library/Application Support/indii-os/sftp_transfer.log
Windows: %APPDATA%/indii-os/sftp_transfer.log
```

**Log Format:**

```
2026-01-18 19:30:15 - INFO - Initiating SFTP upload to ftp.example.com:22
2026-01-18 19:30:20 - INFO - Uploading my_package.zip -> /incoming/my_package.zip
2026-01-18 19:30:45 - INFO - SFTP Upload Successful
```

---

## Troubleshooting 🔧

### Common Issues

#### Issue: "Connection refused" (SFTP)

**Cause**: SFTP server is down or firewall blocking port 22  
**Solution**:

- Verify server is online: `ping ftp.example.com`
- Check port: `telnet ftp.example.com 22`
- Contact your hosting provider

#### Issue: "Authentication failed" (SFTP)

**Cause**: Incorrect username/password or key permissions  
**Solution**:

- Verify credentials with your provider
- For SSH keys, ensure permissions: `chmod 600 ~/.ssh/id_rsa`
- Try manual connection: `sftp username@ftp.example.com`

#### Issue: "ascp: command not found" (Aspera)

**Cause**: IBM Aspera Connect not installed or not in PATH  
**Solution**:

- Follow [Installation Steps](#installation-steps) above
- Verify installation: `which ascp` (macOS/Linux) or `where ascp` (Windows)
- Restart indiiOS Studio after installation

#### Issue: "Transfer timeout" (Large Files)

**Cause**: Network congestion or slow connection  
**Solution**:

- For SFTP: Use resumable transfers if supported
- For Aspera: Adjust transfer rate with `-l` parameter
- Consider splitting large packages into chunks

#### Issue: "Permission denied" (Remote Directory)

**Cause**: User doesn't have write access to remote path  
**Solution**:

- Verify remote path permissions with provider
- Try a different remote directory (e.g., `/upload/` instead of `/`)
- Check with `sftp>` prompt: `sftp user@host` then `cd /path/` and `put test.txt`

#### Issue: "Python script failed to execute"

**Cause**: Missing Python dependencies in packaged app  
**Solution**:

- Ensure `paramiko` is installed globally: `pip3 install paramiko`
- For packaged apps, dependencies should be bundled via `electron-builder`
- Check Python path in `electron/main.ts` → `PythonBridge`

---

## Additional Resources 📚

### Official Documentation

- **IBM Aspera Connect**: <https://www.ibm.com/aspera/connect/>
- **Paramiko (SFTP)**: <https://www.paramiko.org/>
- **DDEX Standards**: <https://ddex.net/>

### IndiiOS-Specific Files

- **SFTP Uploader**: `execution/distribution/sftp_uploader.py`
- **Aspera Uploader**: `execution/distribution/aspera_uploader.py`
- **IPC Handler**: `electron/handlers/distribution.ts`
- **UI Component**: `src/modules/distribution/components/TransferPanel.tsx`
- **Service Layer**: `src/services/distribution/DistributionService.ts`

### Support Contacts

For distributor-specific Aspera credentials and endpoints, contact:

- **Universal Music**: <aspera-support@umusic.com>
- **Sony Music**: <digital-delivery@sonymusic.com>
- **Warner Music**: <distribution-tech@warnermusic.com>
- **INgrooves (FUGA)**: <support@ingrooves.com>

---

## Quick Start Commands 🚀

### Development Mode

```bash
npm run dev
# Navigate to Distribution → Transmission tab
```

### Production Build

```bash
npm run build:studio
npx electron-builder --mac --publish never
```

### Run Tests

```bash
# TypeScript integration tests
npm run test src/services/distribution/DistributionService.integration.test.ts

# Python unit tests
python3 -m pytest execution/distribution/tests/test_sftp_uploader.py
```

### Check Aspera Installation

```bash
which ascp || echo "Aspera not found - see installation guide"
```

---

## Version History 📅

**v1.0.0 (2026-01-18)**

- ✅ SFTP transmission fully operational
- ✅ Aspera script implemented (awaiting binary)
- ✅ TransferPanel UI complete
- ✅ All integration tests passing

---

**Last Updated**: January 18, 2026  
**Maintained By**: IndiiOS Development Team  
**Document Location**: `docs/distribution/TRANSMISSION_GUIDE.md`

---

**💡 Pro Tip**: Bookmark this document in your browser or IDE for quick reference during distribution workflows!
