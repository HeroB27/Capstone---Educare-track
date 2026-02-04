/**
 * Design System Diagnostic Tool
 * Validates assumptions about the current theme and design system
 */

(function() {
  'use strict';

  const diagnostics = {
    results: [],
    
    log(title, status, details) {
      this.results.push({ title, status, details, timestamp: new Date().toISOString() });
      console.log(`[DIAGNOSTIC] ${status === 'PASS' ? '✓' : status === 'WARN' ? '⚠' : '✗'} ${title}: ${details}`);
    },

    analyze() {
      console.group('🎨 Design System Diagnostic Report');
      console.time('Diagnostic Duration');
      
      // 1. Check CSS Variables
      this.checkCSSVariables();
      
      // 2. Check Typography
      this.checkTypography();
      
      // 3. Check Shadow System
      this.checkShadowSystem();
      
      // 4. Check Animation Framework
      this.checkAnimationFramework();
      
      // 5. Check Responsive Design
      this.checkResponsiveDesign();
      
      // 6. Check Accessibility
      this.checkAccessibility();
      
      // 7. Check Glassmorphism
      this.checkGlassmorphism();
      
      console.table(this.results);
      console.groupEnd();
      console.timeEnd('Diagnostic Duration');
      
      return this.results;
    },

    checkCSSVariables() {
      const root = document.documentElement;
      const requiredVars = [
        '--neutral-50', '--neutral-100', '--neutral-200', '--neutral-300',
        '--neutral-400', '--neutral-500', '--neutral-600', '--neutral-700',
        '--neutral-800', '--neutral-900', '--neutral-950',
        '--theme-primary', '--theme-gradient', '--theme-sidebar',
        '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl',
        '--font-display', '--font-heading', '--font-body',
        '--radius-lg', '--radius-xl'
      ];
      
      let found = 0;
      requiredVars.forEach(v => {
        if (getComputedStyle(root).getPropertyValue(v).trim()) {
          found++;
        }
      });
      
      const coverage = Math.round((found / requiredVars.length) * 100);
      this.log('CSS Variables', coverage >= 90 ? 'PASS' : 'WARN', 
        `Found ${found}/${requiredVars.length} (${coverage}%)`);
      
      // Check for duplicate/overridden variables
      const themeCssVars = getComputedStyle(root);
      const hasRoleVariables = themeCssVars.getPropertyValue('--admin-primary')?.trim() ||
                               themeCssVars.getPropertyValue('--teacher-primary')?.trim();
      this.log('Role Variables', hasRoleVariables ? 'PASS' : 'FAIL', 
        hasRoleVariables ? 'Role-based colors present' : 'Missing role-based color tokens');
    },

    checkTypography() {
      const fonts = ['Inter', 'Space Grotesk', 'Fraunces'];
      let found = 0;
      fonts.forEach(font => {
        if (document.fonts.check(`16px "${font}"`)) {
          found++;
        }
      });
      
      this.log('Typography', found >= 2 ? 'PASS' : 'WARN', 
        `${found}/${fonts.length} fonts loaded`);
      
      // Check font weights
      const bodyFont = getComputedStyle(document.body).fontFamily;
      this.log('Font Stack', bodyFont.includes('Inter') ? 'PASS' : 'WARN', 
        `Body font: ${bodyFont}`);
    },

    checkShadowSystem() {
      const shadows = ['--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl', '--shadow-layered'];
      let defined = 0;
      
      shadows.forEach(s => {
        const value = getComputedStyle(document.documentElement).getPropertyValue(s).trim();
        if (value) defined++;
      });
      
      this.log('Shadow System', defined >= 4 ? 'PASS' : 'WARN', 
        `${defined}/${shadows.length} shadow tokens defined`);
    },

    checkAnimationFramework() {
      // Check for keyframe animations
      const styles = document.styleSheets;
      let hasKeyframes = false;
      let animationCount = 0;
      
      try {
        for (const sheet of styles) {
          for (const rule of sheet.cssRules) {
            if (rule.type === CSSRule.KEYFRAMES_RULE) {
              hasKeyframes = true;
              animationCount++;
            }
            if (rule.type === CSSRule.MEDIA_RULE) {
              // Check for prefers-reduced-motion
              if (rule.conditionText?.includes('prefers-reduced-motion')) {
                this.log('Reduced Motion', 'PASS', 'prefers-reduced-motion media query found');
              }
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheets may throw
      }
      
      this.log('Animations', hasKeyframes ? 'PASS' : 'WARN', 
        `${animationCount} keyframe animations defined`);
      
      // Check for transition classes
      const hasTransitions = document.querySelectorAll('[class*="transition-"], [class*="animate-"]').length > 0;
      this.log('Transition Classes', hasTransitions ? 'PASS' : 'WARN', 
        hasTransitions ? 'Transition classes present' : 'Missing transition classes');
    },

    checkResponsiveDesign() {
      // Check for responsive breakpoints
      const styles = document.styleSheets;
      let hasBreakpoints = false;
      
      try {
        for (const sheet of styles) {
          for (const rule of sheet.cssRules) {
            if (rule.type === CSSRule.MEDIA_RULE) {
              if (rule.conditionText?.includes('max-width') || rule.conditionText?.includes('min-width')) {
                hasBreakpoints = true;
                break;
              }
            }
          }
          if (hasBreakpoints) break;
        }
      } catch (e) {}
      
      this.log('Responsive Breakpoints', hasBreakpoints ? 'PASS' : 'WARN', 
        hasBreakpoints ? 'Media queries present' : 'No responsive breakpoints found');
      
      // Check viewport meta
      const viewport = document.querySelector('meta[name="viewport"]');
      this.log('Viewport Meta', viewport ? 'PASS' : 'FAIL', 
        viewport ? 'Viewport meta tag present' : 'Missing viewport meta tag');
    },

    checkAccessibility() {
      // Check for ARIA labels on interactive elements
      const interactive = document.querySelectorAll('button, [role="button"], a, input, select, textarea');
      let withAria = 0;
      
      interactive.forEach(el => {
        if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title) {
          withAria++;
        }
      });
      
      const coverage = Math.round((withAria / Math.min(interactive.length, 20)) * 100);
      this.log('ARIA Labels', coverage >= 50 ? 'PASS' : 'WARN', 
        `${coverage}% of sampled elements have labels`);
      
      // Check focus states
      const hasFocusStyles = document.querySelectorAll(':focus-visible, [class*="focus:"]').length > 0;
      this.log('Focus States', hasFocusStyles ? 'PASS' : 'WARN', 
        hasFocusStyles ? 'Focus styles present' : 'Missing focus-visible styles');
      
      // Check color contrast hint
      const bg = getComputedStyle(document.body).backgroundColor;
      const text = getComputedStyle(document.body).color;
      this.log('Color Variables', bg && text ? 'PASS' : 'WARN', 
        `Background: ${bg}, Text: ${text}`);
    },

    checkGlassmorphism() {
      const glassClasses = ['.glass-panel', '.glass-header', '.glass-sidebar', '.glass-card'];
      let found = 0;
      
      glassClasses.forEach(selector => {
        try {
          const sheet = [...document.styleSheets].find(s => {
            try { return [...s.cssRules].some(r => r.selectorText?.includes(selector.replace('.', ''))); }
            catch { return false; }
          });
          if (sheet) found++;
        } catch {}
      });
      
      this.log('Glassmorphism', found >= 3 ? 'PASS' : 'WARN', 
        `${found}/${glassClasses.length} glassmorphism classes defined`);
    }
  };

  // Run diagnostics when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => diagnostics.analyze());
  } else {
    // Give fonts time to load
    setTimeout(() => diagnostics.analyze(), 500);
  }

  // Expose for console access
  window.DesignDiagnostics = diagnostics;
})();
