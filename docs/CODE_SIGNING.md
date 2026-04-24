# Code Signing for Electron Desktop Builds

This document describes the code signing setup for indiiOS desktop applications across macOS and Windows platforms.

## Overview

Code signing is a security requirement for distributing desktop applications. It:
- Authenticates the publisher identity
- Prevents tampering detection by OS security features
- Enables auto-update functionality
- Improves user trust and reduces browser warnings

## macOS Code Signing

### Requirements

- Apple Developer Program membership
- Code Signing Certificate (Developer ID Application)
- Provisioning profiles
- Xcode Command Line Tools

### Setup

1. **Create/Import Certificate**
   ```bash
   # Export certificate from Keychain as .p12
   # Store securely (recommended: CI/CD secrets)
   ```

2. **Set Environment Variables**
   ```bash
   export CSC_LINK="path/to/certificate.p12"
   export CSC_KEY_PASSWORD="certificate-password"
   export APPLE_TEAM_ID="XXXXXXXXXX"  # From Apple Developer account
   export APPLE_ID="your-email@apple.com"
   export APPLE_ID_PASSWORD="app-specific-password"
   ```

3. **Build with Signing**
   ```bash
   npm run build:desktop:mac
   ```

### Notarization

macOS requires app notarization for distribution:

1. The build process automatically notarizes the app
2. Apple scans for malware and security issues
3. Notarization status returned within 24 hours
4. Apps can be distributed immediately upon completion

**Environment variables for notarization:**
- `APPLE_ID` - Apple ID email
- `APPLE_ID_PASSWORD` - App-specific password (NOT regular password)
- `APPLE_TEAM_ID` - Developer Team ID

### Entitlements

macOS apps use entitlements to request specific capabilities:

**File:** `build/entitlements.mac.plist`
- File system access
- Network access
- Microphone/Camera access
- Hardened runtime enabled for security

## Windows Code Signing

### Requirements

- Code Signing Certificate (EV or Standard)
- SignTool.exe (Windows SDK)
- Timestamp server access for revocation checks

### Setup

1. **Obtain Code Signing Certificate**
   - Purchase from trusted CA (Sectigo, DigiCert, etc.)
   - EV certificates recommended for driver/system software
   - Standard certificates sufficient for user applications

2. **Install Certificate**
   ```powershell
   # Import .pfx file to Windows Certificate Store
   Import-PfxCertificate -FilePath "cert.pfx" -CertStoreLocation "Cert:\LocalMachine\My"
   ```

3. **Set Environment Variables**
   ```powershell
   $env:WIN_CSC_LINK = "path\to\certificate.pfx"
   $env:WIN_CSC_KEY_PASSWORD = "certificate-password"
   ```

4. **Build with Signing**
   ```bash
   npm run build:desktop:win
   ```

### Signing Script

**File:** `build/sign.js`
- Uses Windows SignTool.exe
- Signs executable files during build
- Includes timestamp server for revocation checks
- Gracefully handles missing credentials (optional in dev)

## CI/CD Integration

### GitHub Actions

Store certificates and passwords in GitHub Secrets:

```yaml
env:
  CSC_LINK: ${{ secrets.MACOS_CERTIFICATE }}
  CSC_KEY_PASSWORD: ${{ secrets.MACOS_CERT_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  WIN_CSC_LINK: ${{ secrets.WINDOWS_CERTIFICATE }}
  WIN_CSC_KEY_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
```

## Distribution

### macOS App Store

1. Create App Store Connect app
2. Provision with App Store profile
3. Configure entitlements
4. Submit for review via Xcode
5. Manage versions and releases in App Store Connect

### Microsoft Store

1. Register Windows Developer account
2. Reserve app name
3. Configure app listings and screenshots
4. Submit signed package
5. Pass Windows App Certification Kit (WACK) tests

### GitHub Releases

1. Build and sign binaries
2. Create GitHub release
3. Upload signed installers
4. Enable auto-update feature in app

### Direct Distribution

1. Host signed installers on CDN
2. Serve with secure HTTPS
3. Configure auto-update endpoint
4. Monitor update metrics

## Development vs Production

### Development Builds
- Code signing optional
- Use self-signed certificates if needed
- Speed prioritized over security

### Production Builds
- Code signing mandatory
- Use certificates from trusted CA
- Notarization required for macOS
- All binaries must be signed

## Troubleshooting

### macOS Issues

**Gatekeeper errors:**
```bash
xattr -d com.apple.quarantine path/to/app.dmg
```

**Notarization failed:**
- Check APPLE_ID credentials
- Verify app was properly signed
- Review notarization logs from Apple

**Entitlements errors:**
- Update entitlements.plist
- Rebuild with latest Xcode
- Check compiler compatibility

### Windows Issues

**SignTool not found:**
```powershell
# Install Windows SDK
# Add to PATH: C:\Program Files (x86)\Windows Kits\10\bin\x64
```

**Certificate not accessible:**
- Verify certificate installed in Cert Store
- Check password is correct
- Ensure service account has permissions

## Security Best Practices

1. **Never commit certificates to version control**
   - Use CI/CD secrets management
   - Rotate certificates annually
   - Monitor certificate usage logs

2. **Use environment variables**
   - Never hardcode credentials
   - Use secrets in CI/CD
   - Clear sensitive data after use

3. **Implement auto-update**
   - Enable checking for updates
   - Sign update packages
   - Verify signatures before installing

4. **Monitor distribution channels**
   - Track downloads
   - Watch for malware reports
   - Respond quickly to security issues

## Item #46 - Platinum Release

This implementation completes TOP_50 Item #46:
> "Add code signing for Electron desktop builds (macOS notarization, Windows signing)"

Features:
- macOS code signing with notarization
- Windows code signing with timestamp
- Environment variable configuration
- CI/CD integration ready
- Comprehensive signing documentation
- Windows SignTool integration script
