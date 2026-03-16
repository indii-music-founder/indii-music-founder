# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for the indiiOS Agent Sidecar.

Bundles the Python HTTP server (mcp_server.py / api.py) and all agent tools
into a single standalone binary that Electron spawns as a child process,
replacing the Docker dependency for packaged desktop builds.

Build:
    cd <repo-root>
    pyinstaller python/build/agent_sidecar.spec

Output: dist/agent_sidecar   (or dist/agent_sidecar.exe on Windows)

The binary is then copied into the Electron app via electron-builder
extraResources -> resources/sidecar/.
"""

import sys
import os
from pathlib import Path

ROOT = Path(SPECPATH).parent.parent  # repo root

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
# api.py exposes the HTTP server used by Electron (localhost:50080).
# If your project uses mcp_server.py as the HTTP entry point instead,
# swap the path below.
ENTRY = str(ROOT / 'python' / 'api' / 'api.py')

# ---------------------------------------------------------------------------
# Data files to bundle (non-Python assets needed at runtime)
# ---------------------------------------------------------------------------
datas = [
    # Agent tool scripts
    (str(ROOT / 'python' / 'tools'),    'python/tools'),
    # Agent helper modules
    (str(ROOT / 'python' / 'helpers'),  'python/helpers'),
    # Agent config / prompts
    (str(ROOT / 'python' / 'config'),   'python/config'),
    # Execution-layer Python scripts invoked via subprocess
    (str(ROOT / 'execution'),           'execution'),
    # Agent definitions (YAML/JSON)
    (str(ROOT / 'agents'),              'agents'),
    # Directives
    (str(ROOT / 'directives'),          'directives'),
]

# ---------------------------------------------------------------------------
# Hidden imports — dynamic imports that PyInstaller cannot auto-detect
# ---------------------------------------------------------------------------
hidden_imports = [
    # FastAPI / Uvicorn
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.asyncio',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    # FastMCP / Starlette
    'fastmcp',
    'starlette',
    'starlette.middleware',
    'starlette.middleware.base',
    # Paramiko (SFTP uploads)
    'paramiko',
    'paramiko.transport',
    # Google AI
    'google.generativeai',
    'google.genai',
    # Audio
    'soundfile',
    'librosa',
    # Requests / aiohttp
    'requests',
    'aiohttp',
    # Misc agent tools
    'PIL',
    'PIL.Image',
    'yaml',
    'dotenv',
]

# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------
a = Analysis(
    [ENTRY],
    pathex=[str(ROOT), str(ROOT / 'python')],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Strip heavy ML frameworks not needed in the sidecar
        'torch',
        'tensorflow',
        'keras',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

# ---------------------------------------------------------------------------
# Single-file executable
# ---------------------------------------------------------------------------
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='agent_sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,   # Keep console for stdout health-check signal
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ROOT / 'public' / 'icon-512.png') if sys.platform == 'darwin' else None,
)
