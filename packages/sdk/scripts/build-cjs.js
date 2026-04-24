#!/usr/bin/env node

/**
 * build-cjs.js - Convert ESM build to CommonJS
 *
 * This script takes the ESM build and creates a CommonJS version
 * for backwards compatibility with CommonJS projects.
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');

// Read the ESM index file
const esmFile = path.join(distDir, 'index.js');
const cjsFile = path.join(distDir, 'index.cjs');

if (fs.existsSync(esmFile)) {
  let content = fs.readFileSync(esmFile, 'utf-8');
  
  // Convert import/export to require/module.exports (basic conversion)
  content = content.replace(/import\s+{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]/g, 
    (match, imports, module) => {
      const importList = imports.split(',').map(i => i.trim()).join(', ');
      return `const { ${importList} } = require('${module}');`;
    }
  );
  
  content = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    (match, name, module) => {
      return `const ${name} = require('${module}');`;
    }
  );
  
  content = content.replace(/export\s+{\s*([^}]+)\s*}/g,
    (match, exports) => {
      const exportList = exports.split(',').map(e => e.trim());
      return `module.exports = { ${exportList.join(', ')} };`;
    }
  );
  
  content = content.replace(/export\s+default\s+(\w+)/g,
    (match, name) => {
      return `module.exports = ${name};`;
    }
  );
  
  fs.writeFileSync(cjsFile, content);
  console.log(`✅ CommonJS build created: ${cjsFile}`);
} else {
  console.error(`❌ ESM file not found: ${esmFile}`);
  process.exit(1);
}
