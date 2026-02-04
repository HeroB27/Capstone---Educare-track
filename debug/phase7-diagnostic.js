/**
 * Phase 7 Implementation Diagnostic Tool
 * Run this in browser console to validate the implementation
 */

(function() {
  console.log("=== Phase 7 Diagnostic Tool ===");
  
  let issues = [];
  let warnings = [];
  
  // 1. Check if service worker is registered
  async function checkServiceWorker() {
    console.log("\n[1/6] Checking Service Worker...");
    if (!('serviceWorker' in navigator)) {
      issues.push("Service Worker not supported in this browser");
      return false;
    }
    
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      console.log("✓ Service Worker registered:", registration.scope);
      return true;
    } else {
      warnings.push("Service Worker not yet registered (will register on first load)");
      return true;
    }
  }
  
  // 2. Check IndexedDB availability
  async function checkIndexedDB() {
    console.log("\n[2/6] Checking IndexedDB...");
    if (!('indexedDB' in window)) {
      issues.push("IndexedDB not supported - offline queue will not work");
      return false;
    }
    
    try {
      const testDB = await new Promise((resolve, reject) => {
        const request = indexedDB.open('test', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve(true);
        };
      });
      console.log("✓ IndexedDB available");
      return true;
    } catch (e) {
      issues.push("IndexedDB error: " + e.message);
      return false;
    }
  }
  
  // 3. Check Supabase connection
  async function checkSupabase() {
    console.log("\n[3/6] Checking Supabase Connection...");
    try {
      const { data, error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        if (error.message.includes('relation') || error.message.includes('table')) {
          warnings.push("Supabase tables may not exist yet: " + error.message);
        } else {
          issues.push("Supabase error: " + error.message);
        }
        return false;
      }
      console.log("✓ Supabase connected successfully");
      return true;
    } catch (e) {
      issues.push("Supabase connection failed: " + e.message);
      return false;
    }
  }
  
  // 4. Check network status
  function checkNetworkStatus() {
    console.log("\n[4/6] Checking Network Status...");
    console.log("✓ Navigator.onLine:", navigator.onLine);
    console.log("✓ Network status indicator present:", !!document.getElementById('network-status'));
    return true;
  }
  
  // 5. Check DOM elements
  function checkDOMElements() {
    console.log("\n[5/6] Checking Required DOM Elements...");
    const requiredElements = [
      'teacherStatus', 'teacherApp',
      'parentStatus', 'parentApp',
      'notifStatus', 'notifApp',
      'announceStatus', 'announceApp',
      'appSidebar', 'topbar'
    ];
    
    let found = 0;
    requiredElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        found++;
        console.log(`✓ Found: #${id}`);
      } else {
        console.log(`✗ Missing: #${id} (may be expected on this page)`);
      }
    });
    
    return found > 0;
  }
  
  // 6. Check console for errors
  function checkConsoleErrors() {
    console.log("\n[6/6] Checking for common errors...");
    
    // Check for duplicate event listeners
    if (window._shellCleanup) {
      console.log("✓ Shell cleanup handler registered");
    }
    
    // Check for PWA registration
    if (window._pwaRegistration) {
      console.log("✓ PWA registration cached");
    }
    
    return true;
  }
  
  // Run all checks
  async function runDiagnostics() {
    console.log("Starting Phase 7 diagnostics...\n");
    console.log("Current page:", window.location.pathname);
    console.log("User agent:", navigator.userAgent);
    
    await checkServiceWorker();
    await checkIndexedDB();
    await checkSupabase();
    checkNetworkStatus();
    checkDOMElements();
    checkConsoleErrors();
    
    console.log("\n=== Diagnostic Summary ===");
    
    if (issues.length > 0) {
      console.log("\n❌ ISSUES FOUND:");
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    } else {
      console.log("\n✓ No critical issues found");
    }
    
    if (warnings.length > 0) {
      console.log("\n⚠️ WARNINGS:");
      warnings.forEach((warning, i) => console.log(`  ${i + 1}. ${warning}`));
    }
    
    console.log("\n=== Recommendations ===");
    if (issues.length === 0 && warnings.length === 0) {
      console.log("✓ Phase 7 implementation appears to be working correctly!");
      console.log("✓ You can proceed with testing the PWA features.");
    } else if (issues.length > 0) {
      console.log("✗ Please resolve the issues above before proceeding.");
    } else {
      console.log("⚠️ Review the warnings and address if necessary.");
    }
    
    return { issues, warnings };
  }
  
  // Export for manual use
  window.phase7Diagnostic = {
    run: runDiagnostics,
    checkServiceWorker,
    checkIndexedDB,
    checkSupabase,
    checkNetworkStatus,
    checkDOMElements,
    checkConsoleErrors
  };
  
  // Auto-run if in debug mode
  if (window.location.search.includes('debug=true')) {
    runDiagnostics();
  }
})();
