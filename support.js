/**
 * Design Canvas Support Module
 * Provides utilities for design audit visualization and analysis
 */

// Design system configuration
const designSystem = {
  tokens: {
    colors: {
      primary: '#2196F3',
      accent: '#FFB800',
      accentSecondary: '#FF7043',
      background: '#030303',
      surface: '#1a1a1a',
      card: '#14100c',
      elevated: '#0d1117',
      border: 'rgba(255, 255, 255, 0.1)',
      textPrimary: '#ffffff',
      textMuted: '#a0a0a0',
    },
    departments: {
      creative: '#FFC107',
      studio: '#2196F3',
      distribution: '#E91E63',
      master: '#455A64',
      audio: '#00BCD4',
      video: '#009688',
      marketing: '#FFB300',
      promotion: '#FF7043',
      launch: '#00ff66',
      revenue: '#FF5722',
      growth: '#8BC34A',
    },
    typography: {
      fontMain: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontGeist: 'var(--font-geist-sans)',
    },
  },
  issues: [
    {
      id: 1,
      severity: 'high',
      title: 'Hardcoded Colors in Sidebar.tsx',
      description: 'bg-[#0d1117], bg-[#1a1a1a] hardcoded; should use CSS variables',
      file: 'Sidebar.tsx:42-58',
      impact: 'Blocks design token consolidation',
    },
    {
      id: 2,
      severity: 'high',
      title: 'Inconsistent Border Usage in card.tsx',
      description: 'border-white/10 literal when --border token exists',
      file: 'card.tsx:15-20',
      impact: 'Inconsistent with design system',
    },
    {
      id: 3,
      severity: 'high',
      title: 'Duplicate Design Token Systems',
      description: '--sonic-purple, --sonic-blue, --sonic-yellow in index.css parallel to --dept-color',
      file: 'index.css:80-95',
      impact: 'Maintenance burden and confusion',
    },
    {
      id: 4,
      severity: 'high',
      title: 'Inconsistent Shadow Tokens',
      description: 'shadow-black/20 hardcoded; should use standardized shadow token',
      file: 'card.tsx:18, Sidebar.tsx:52',
      impact: 'Inconsistent visual hierarchy',
    },
    {
      id: 5,
      severity: 'high',
      title: 'Missing Department Color Variants',
      description: '--dept-color-muted and --dept-color-glow not applied consistently',
      file: 'AppShell.tsx, multiple files',
      impact: 'Department identity unclear',
    },
    {
      id: 6,
      severity: 'high',
      title: 'Hardcoded RGBA in Sidebar.tsx',
      description: 'rgba(99,102,241,*) and rgba(245,158,11,*) for CTAs bypass token system',
      file: 'Sidebar.tsx:65-72',
      impact: 'Violates design system rules',
    },
  ],
  components: [
    {
      name: 'Button',
      file: 'components/ui/button.tsx',
      tags: ['interactive', 'glass'],
      issues: 0,
    },
    {
      name: 'Card',
      file: 'components/ui/card.tsx',
      tags: ['surface', 'container'],
      issues: 1,
    },
    {
      name: 'ThreeDCard',
      file: 'components/ThreeDCard.tsx',
      tags: ['animation', '3d'],
      issues: 0,
    },
    {
      name: 'Sidebar',
      file: 'components/Sidebar.tsx',
      tags: ['layout', 'navigation'],
      issues: 3,
    },
    {
      name: 'AppShell',
      file: 'components/AppShell.tsx',
      tags: ['layout', 'root'],
      issues: 2,
    },
    {
      name: 'Dialogs',
      file: 'components/*Dialog.tsx',
      tags: ['modal', 'overlay'],
      issues: 0,
    },
  ],
};

/**
 * Initialize the design canvas with data and interactions
 */
function initializeDesignCanvas() {
  console.log('Design Canvas initialized');
  console.log('Design System:', designSystem);

  // Set up color picker interactions
  setupColorPickers();

  // Initialize statistics
  updateStatistics();

  // Add keyboard shortcuts
  setupKeyboardShortcuts();
}

/**
 * Set up color picker interactions
 */
function setupColorPickers() {
  document.querySelectorAll('.color-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const label = item.querySelector('.color-label').textContent;
      const hexMatch = label.match(/#[A-F0-9]{6}|#[A-F0-9]{3}/i);
      if (hexMatch) {
        copyToClipboard(hexMatch[0]);
        showNotification(`Copied ${hexMatch[0]}`);
      }
    });
  });
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Show temporary notification
 */
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #FFB800;
    color: #030303;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

/**
 * Update statistics on page load
 */
function updateStatistics() {
  const stats = {
    totalIssues: designSystem.issues.length,
    highSeverity: designSystem.issues.filter((i) => i.severity === 'high').length,
    totalComponents: designSystem.components.length,
    totalTokens: Object.keys(designSystem.tokens.colors).length,
  };

  return stats;
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K to show command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      showCommandPalette();
    }

    // Esc to close dialogs
    if (e.key === 'Escape') {
      closeCommandPalette();
    }
  });
}

/**
 * Show command palette for quick navigation
 */
function showCommandPalette() {
  const palette = document.createElement('div');
  palette.id = 'command-palette';
  palette.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #0d1117;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 20px;
    width: 90%;
    max-width: 500px;
    z-index: 2000;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  `;

  const title = document.createElement('input');
  title.type = 'text';
  title.placeholder = 'Go to view...';
  title.style.cssText = `
    width: 100%;
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    padding: 12px;
    border-radius: 6px;
    font-size: 14px;
    margin-bottom: 12px;
  `;

  palette.appendChild(title);
  document.body.appendChild(palette);
  title.focus();

  title.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      palette.remove();
    }
  });
}

/**
 * Close command palette
 */
function closeCommandPalette() {
  const palette = document.getElementById('command-palette');
  if (palette) {
    palette.remove();
  }
}

/**
 * Get color by department
 */
function getDepartmentColor(department) {
  return designSystem.tokens.departments[department] || designSystem.tokens.colors.accent;
}

/**
 * Generate issue report
 */
function generateIssueReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalIssues: designSystem.issues.length,
      highSeverity: designSystem.issues.filter((i) => i.severity === 'high').length,
      mediumSeverity: designSystem.issues.filter((i) => i.severity === 'medium').length,
      lowSeverity: designSystem.issues.filter((i) => i.severity === 'low').length,
    },
    issues: designSystem.issues,
    affectedComponents: designSystem.components.filter((c) => c.issues > 0),
  };

  return report;
}

/**
 * Export design tokens as CSS
 */
function exportDesignTokensAsCSS() {
  let css = ':root {\n';

  // Add color tokens
  Object.entries(designSystem.tokens.colors).forEach(([key, value]) => {
    css += `  --${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};\n`;
  });

  // Add department colors
  css += '\n  /* Department Colors */\n';
  Object.entries(designSystem.tokens.departments).forEach(([key, value]) => {
    css += `  --dept-${key}: ${value};\n`;
  });

  css += '}\n';

  return css;
}

/**
 * Validate design token usage in component
 */
function validateComponentTokens(componentName) {
  const component = designSystem.components.find((c) => c.name === componentName);

  if (!component) {
    return { valid: false, message: 'Component not found' };
  }

  return {
    valid: component.issues === 0,
    component: componentName,
    issues: component.issues,
    file: component.file,
  };
}

/**
 * Get design recommendations
 */
function getRecommendations() {
  return [
    {
      phase: 1,
      title: 'Token Consolidation',
      tasks: [
        'Merge --sonic-* tokens into main CSS variable system',
        'Define --shadow-* tokens (sm, md, lg, xl)',
        'Create --backdrop-blur-* tokens',
        'Document all tokens in design-tokens.md',
      ],
    },
    {
      phase: 2,
      title: 'Component Refactoring',
      tasks: [
        'Refactor Sidebar.tsx to use CSS variables',
        'Update card.tsx to use glass-panel pattern',
        'Apply --dept-color variants consistently',
        'Add guard rule to prevent hardcoded colors',
      ],
    },
    {
      phase: 3,
      title: 'Quality Gates',
      tasks: [
        'Implement guard-no-hardcoded-color.mjs ESLint rule',
        'Add security:frontend-api-boundary check',
        'Document design token usage',
        'Schedule monthly design system audits',
      ],
    },
  ];
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    designSystem,
    initializeDesignCanvas,
    getDepartmentColor,
    generateIssueReport,
    exportDesignTokensAsCSS,
    validateComponentTokens,
    getRecommendations,
    copyToClipboard,
    showNotification,
  };
}
