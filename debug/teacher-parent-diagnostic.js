<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EDUCARE COLLEGES INC | Debug - Teacher & Parent Features</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../core/theme.css" />
    <link rel="stylesheet" href="../core/vibrant-theme.css" />
    <style>
      * { font-family: 'Inter', sans-serif; }
      .debug-section { margin-bottom: 1.5rem; }
      .debug-item { padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem; }
      .debug-pass { background: #dcfce7; color: #166534; }
      .debug-fail { background: #fee2e2; color: #991b1b; }
      .debug-warn { background: #fef3c7; color: #92400e; }
      .debug-info { background: #dbeafe; color: #1e40af; }
    </style>
  </head>
  <body class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
    <div class="p-4 lg:p-8 max-w-7xl mx-auto">
      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-3xl lg:text-4xl font-bold text-slate-900">
          Debug: <span class="gradient-text">Teacher & Parent Features</span>
        </h1>
        <p class="mt-2 text-slate-600">Diagnose and fix common issues in teacher and parent workflows</p>
      </div>

      <!-- Test Selection -->
      <div class="glass-card rounded-3xl p-6 soft-shadow mb-8">
        <h2 class="text-lg font-bold text-slate-900 mb-4">Select Tests to Run</h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="testAuth" checked class="w-4 h-4 text-blue-600">
            <span class="text-sm">Authentication</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" id="testSupabase" checked class="w-4 h-4 text-blue-600">
            <span class="text-sm">Supabase Connection</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" id="testTables" checked class="w-4 h-4 text-blue-600">
            <span class="text-sm">Database Tables</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" id="testRealtime" checked class="w-4 h-4 text-blue-600">
            <span class="text-sm">Real-time Subscriptions</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" id="testStorage" checked class="w-4 h-4 text-blue-600">
            <span class="text-sm">Storage Buckets</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" id="testTeacher" checked class="w-4 h-4 text-blue-600">
            <span class="text-sm">Teacher Features</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" id="testParent" checked class="w-4 h-4 text-blue-600">
            <span class="text-sm">Parent Features</span>
          </label>
        </div>
        <button id="runTests" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg">
          Run Diagnostics
        </button>
      </div>

      <!-- Progress -->
      <div id="progressSection" class="glass-card rounded-3xl p-6 soft-shadow mb-8 hidden">
        <h2 class="text-lg font-bold text-slate-900 mb-4">Running Diagnostics...</h2>
        <div class="w-full bg-slate-200 rounded-full h-4">
          <div id="progressBar" class="bg-blue-600 h-4 rounded-full transition-all" style="width: 0%"></div>
        </div>
        <p id="progressText" class="mt-2 text-sm text-slate-600">Initializing...</p>
      </div>

      <!-- Results -->
      <div id="resultsSection" class="hidden">
        <!-- Summary -->
        <div class="glass-card rounded-3xl p-6 soft-shadow mb-8">
          <h2 class="text-lg font-bold text-slate-900 mb-4">Summary</h2>
          <div class="grid grid-cols-3 gap-4">
            <div class="text-center p-4 bg-green-100 rounded-xl">
              <p class="text-2xl font-bold text-green-700" id="passCount">0</p>
              <p class="text-sm text-green-600">Passed</p>
            </div>
            <div class="text-center p-4 bg-red-100 rounded-xl">
              <p class="text-2xl font-bold text-red-700" id="failCount">0</p>
              <p class="text-sm text-red-600">Failed</p>
            </div>
            <div class="text-center p-4 bg-yellow-100 rounded-xl">
              <p class="text-2xl font-bold text-yellow-700" id="warnCount">0</p>
              <p class="text-sm text-yellow-600">Warnings</p>
            </div>
          </div>
        </div>

        <!-- Detailed Results -->
        <div id="detailedResults"></div>

        <!-- Fix Recommendations -->
        <div class="glass-card rounded-3xl p-6 soft-shadow mt-8">
          <h2 class="text-lg font-bold text-slate-900 mb-4">Recommended Fixes</h2>
          <div id="fixRecommendations" class="space-y-3"></div>
        </div>
      </div>
    </div>

    <script type="module">
      import { supabase, requireAuthAndProfile, getProfile } from "../core/core.js";

      const resultsSection = document.getElementById('resultsSection');
      const progressSection = document.getElementById('progressSection');
      const progressBar = document.getElementById('progressBar');
      const progressText = document.getElementById('progressText');
      const detailedResults = document.getElementById('detailedResults');
      const fixRecommendations = document.getElementById('fixRecommendations');

      let testResults = [];
      let passCount = 0;
      let failCount = 0;
      let warnCount = 0;

      function updateProgress(percent, text) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = text;
      }

      function addResult(category, test, status, message, fix = null) {
        testResults.push({ category, test, status, message, fix });
        if (status === 'pass') passCount++;
        else if (status === 'fail') failCount++;
        else warnCount++;

        const resultDiv = document.createElement('div');
        resultDiv.className = 'debug-section';
        resultDiv.innerHTML = `
          <h3 class="text-md font-semibold text-slate-900 mb-2">${category}</h3>
          <div class="debug-item debug-${status}">
            <div class="flex items-center gap-2">
              <span class="font-semibold">${test}:</span>
              <span>${message}</span>
            </div>
          </div>
        `;
        detailedResults.appendChild(resultDiv);

        if (fix) {
          const fixDiv = document.createElement('div');
          fixDiv.className = 'ml-4 p-3 bg-slate-100 rounded-lg text-sm';
          fixDiv.innerHTML = `<strong>Fix:</strong> ${fix}`;
          resultDiv.appendChild(fixDiv);
        }
      }

      async function runAuthTests() {
        updateProgress(10, 'Testing authentication...');
        
        try {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          
          if (authError) {
            addResult('Authentication', 'Auth Connection', 'fail', `Auth error: ${authError.message}`, 
              'Check Supabase URL and anon key in core/config.js');
          } else if (!user) {
            addResult('Authentication', 'User Session', 'fail', 'No authenticated user', 
              'User needs to log in via auth/login.html');
          } else {
            addResult('Authentication', 'User Session', 'pass', `User ID: ${user.id.substring(0, 8)}...`);

            const { profile, error: profileError } = await requireAuthAndProfile();
            if (profileError) {
              addResult('Authentication', 'Profile Loading', 'fail', `Profile error: ${profileError.message}`,
                'Check profiles table and RLS policies');
            } else {
              addResult('Authentication', 'Profile Loading', 'pass', `Role: ${profile?.role}, Name: ${profile?.full_name || 'N/A'}`);
              
              // Check role
              if (!['teacher', 'parent'].includes(profile?.role)) {
                addResult('Authentication', 'Role Check', 'warn', `User role is "${profile?.role}" - tests will use teacher features`,
                  'Ensure user has correct role assigned');
              }
            }
          }
        } catch (e) {
          addResult('Authentication', 'Auth Test', 'fail', `Exception: ${e.message}`,
            'Check browser console for more details');
        }
      }

      async function runSupabaseTests() {
        updateProgress(25, 'Testing Supabase connection...');
        
        try {
          const { data, error } = await supabase.from('profiles').select('id').limit(1);
          
          if (error) {
            addResult('Supabase', 'Connection', 'fail', `Connection error: ${error.message}`,
              'Verify Supabase URL and anon key are correct in core/config.js');
            return false;
          } else {
            addResult('Supabase', 'Connection', 'pass', 'Successfully connected to Supabase');
            return true;
          }
        } catch (e) {
          addResult('Supabase', 'Connection', 'fail', `Exception: ${e.message}`,
            'Check network connection and Supabase configuration');
          return false;
        }
      }

      async function runTableTests(connected) {
        updateProgress(40, 'Testing database tables...');
        
        const tables = [
          'profiles', 'students', 'classes', 'class_schedules',
          'homeroom_attendance', 'subject_attendance', 'tap_logs',
          'excuse_letters', 'announcements', 'notifications',
          'clinic_visits', 'clinic_passes'
        ];

        for (const table of tables) {
          try {
            const { data, error } = await supabase.from(table).select('id').limit(1);
            
            if (error) {
              if (error.code === '42P01') { // undefined_table
                addResult('Database Tables', table, 'fail', 'Table does not exist',
                  `Run migration: supabase_migrations/2026-02-04_phase3_teachers_parents_v0.0.1.sql`);
              } else if (error.code === '42501') { // permission_denied
                addResult('Database Tables', table, 'warn', 'Permission denied - RLS may be blocking',
                  'Check RLS policies for this table');
              } else {
                addResult('Database Tables', table, 'fail', `Error: ${error.message}`,
                  'Check table structure and permissions');
              }
            } else {
              addResult('Database Tables', table, 'pass', 'Table accessible');
            }
          } catch (e) {
            addResult('Database Tables', table, 'fail', `Exception: ${e.message}`);
          }
        }
      }

      async function runTeacherFeatureTests() {
        updateProgress(60, 'Testing teacher features...');
        
        try {
          const { profile } = await requireAuthAndProfile();
          
          // Test homeroom classes query
          const { data: homeroomData, error: homeroomError } = await supabase
            .from('classes')
            .select('id,grade_level,strand,room')
            .eq('homeroom_teacher_id', profile?.id)
            .eq('is_active', true);

          if (homeroomError) {
            addResult('Teacher Features', 'Homeroom Classes', 'fail', `Error: ${homeroomError.message}`);
          } else {
            addResult('Teacher Features', 'Homeroom Classes', 'pass', 
              `Found ${homeroomData?.length || 0} homeroom classes`);
          }

          // Test schedules query
          const { data: scheduleData, error: scheduleError } = await supabase
            .from('class_schedules')
            .select('id,class_id,subject_code,day_of_week,start_time,end_time')
            .eq('teacher_id', profile?.id);

          if (scheduleError) {
            addResult('Teacher Features', 'Class Schedules', 'fail', `Error: ${scheduleError.message}`);
          } else {
            addResult('Teacher Features', 'Class Schedules', 'pass', 
              `Found ${scheduleData?.length || 0} scheduled classes`);
          }

          // Test excuse letters query
          const { data: excuseData, error: excuseError } = await supabase
            .from('excuse_letters')
            .select('id,student_id,status')
            .order('created_at', { ascending: false })
            .limit(10);

          if (excuseError) {
            addResult('Teacher Features', 'Excuse Letters', 'fail', `Error: ${excuseError.message}`);
          } else {
            addResult('Teacher Features', 'Excuse Letters', 'pass', 
              `Found ${excuseData?.length || 0} excuse letters`);
          }

          // Test announcements query
          const { data: announceData, error: announceError } = await supabase
            .from('announcements')
            .select('id,title,body')
            .eq('created_by', profile?.id)
            .limit(10);

          if (announceError) {
            addResult('Teacher Features', 'Announcements', 'fail', `Error: ${announceError.message}`);
          } else {
            addResult('Teacher Features', 'Announcements', 'pass', 
              `Found ${announceData?.length || 0} announcements`);
          }

        } catch (e) {
          addResult('Teacher Features', 'Feature Tests', 'fail', `Exception: ${e.message}`);
        }
      }

      async function runParentFeatureTests() {
        updateProgress(75, 'Testing parent features...');
        
        try {
          const { profile } = await requireAuthAndProfile();
          
          // Test students query for parent
          const { data: childrenData, error: childrenError } = await supabase
            .from('students')
            .select('id,full_name,grade_level,strand,class_id')
            .eq('parent_id', profile?.id);

          if (childrenError) {
            addResult('Parent Features', 'Linked Children', 'fail', `Error: ${childrenError.message}`);
          } else {
            const count = childrenData?.length || 0;
            if (count === 0) {
              addResult('Parent Features', 'Linked Children', 'warn', 
                'No children linked to this parent account',
                'Ask admin to link students to this parent account via admin/admin-parent-students.html');
            } else {
              addResult('Parent Features', 'Linked Children', 'pass', 
                `Found ${count} linked child(ren)`);
            }
          }

          // Test homeroom attendance query
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('homeroom_attendance')
            .select('id,student_id,date,status')
            .order('date', { ascending: false })
            .limit(100);

          if (attendanceError) {
            addResult('Parent Features', 'Attendance History', 'fail', `Error: ${attendanceError.message}`);
          } else {
            addResult('Parent Features', 'Attendance History', 'pass', 
              `Found ${attendanceData?.length || 0} attendance records`);
          }

          // Test tap logs query
          const { data: tapData, error: tapError } = await supabase
            .from('tap_logs')
            .select('id,student_id,tap_type,timestamp')
            .order('timestamp', { ascending: false })
            .limit(50);

          if (tapError) {
            addResult('Parent Features', 'Tap Logs', 'fail', `Error: ${tapError.message}`);
          } else {
            addResult('Parent Features', 'Tap Logs', 'pass', 
              `Found ${tapData?.length || 0} tap log records`);
          }

          // Test notifications query
          const { data: notifData, error: notifError } = await supabase
            .from('notifications')
            .select('id,recipient_id,verb,read,created_at')
            .eq('recipient_id', profile?.id)
            .order('created_at', { ascending: false })
            .limit(20);

          if (notifError) {
            addResult('Parent Features', 'Notifications', 'fail', `Error: ${notifError.message}`);
          } else {
            const unreadCount = notifData?.filter(n => !n.read).length || 0;
            addResult('Parent Features', 'Notifications', 'pass', 
              `Found ${notifData?.length || 0} notifications (${unreadCount} unread)`);
          }

        } catch (e) {
          addResult('Parent Features', 'Feature Tests', 'fail', `Exception: ${e.message}`);
        }
      }

      async function runStorageTests() {
        updateProgress(85, 'Testing storage buckets...');
        
        const buckets = ['excuse_letters', 'student-photos', 'idcards'];
        
        for (const bucket of buckets) {
          try {
            const { data, error } = await supabase.storage.getBucket(bucket);
            
            if (error) {
              if (error.message.includes('not found')) {
                addResult('Storage Buckets', bucket, 'warn', 'Bucket not found',
                  `Create bucket "${bucket}" in Supabase Storage`);
              } else {
                addResult('Storage Buckets', bucket, 'fail', `Error: ${error.message}`);
              }
            } else {
              addResult('Storage Buckets', bucket, 'pass', 'Bucket accessible');
            }
          } catch (e) {
            addResult('Storage Buckets', bucket, 'fail', `Exception: ${e.message}`);
          }
        }
      }

      async function runRealtimeTests() {
        updateProgress(95, 'Testing real-time subscriptions...');
        
        try {
          // Check if we can create a channel
          const channel = supabase.channel('test-channel');
          
          if (channel) {
            addResult('Real-time', 'Channel Creation', 'pass', 'Can create channels');
            
            // Subscribe and immediately unsubscribe
            channel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                addResult('Real-time', 'Channel Subscription', 'pass', 'Successfully subscribed to channel');
                supabase.removeChannel(channel);
              } else if (status === 'CLOSED') {
                supabase.removeChannel(channel);
              }
            });
          } else {
            addResult('Real-time', 'Channel Creation', 'fail', 'Cannot create channels');
          }
        } catch (e) {
          addResult('Real-time', 'Subscription Test', 'fail', `Exception: ${e.message}`);
        }
      }

      function generateRecommendations() {
        fixRecommendations.innerHTML = '';
        const failures = testResults.filter(r => r.status === 'fail');
        const warnings = testResults.filter(r => r.status === 'warn');

        if (failures.length === 0 && warnings.length === 0) {
          fixRecommendations.innerHTML = `
            <div class="p-4 bg-green-100 rounded-xl text-green-800">
              All tests passed! No fixes needed.
            </div>
          `;
          return;
        }

        // Common issues and fixes
        const commonFixes = [
          {
            condition: failures.some(f => f.message.includes('undefined_table')),
            fix: 'Run database migrations: supabase_migrations/2026-02-04_phase3_teachers_parents_v0.0.1.sql'
          },
          {
            condition: failures.some(f => f.message.includes('permission_denied')),
            fix: 'Check RLS policies. Ensure user has correct role and permissions.'
          },
          {
            condition: failures.some(f => f.message.includes('No authenticated user')),
            fix: 'User needs to log in via auth/login.html first'
          },
          {
            condition: warnings.some(w => w.message.includes('No children linked')),
            fix: 'Admin must link students to parent via admin/admin-parent-students.html'
          },
          {
            condition: failures.some(f => f.message.includes('Connection error')),
            fix: 'Verify Supabase URL and anon key in core/config.js'
          }
        ];

        const shownFixes = new Set();
        for (const item of commonFixes) {
          if (item.condition) {
            const fixDiv = document.createElement('div');
            fixDiv.className = 'p-3 bg-blue-50 rounded-lg border border-blue-200';
            fixDiv.innerHTML = `<strong>Recommended:</strong> ${item.fix}`;
            fixRecommendations.appendChild(fixDiv);
            shownFixes.add(item.fix);
          }
        }

        // Add individual failures
        for (const failure of failures) {
          if (failure.fix && !shownFixes.has(failure.fix)) {
            const fixDiv = document.createElement('div');
            fixDiv.className = 'p-3 bg-red-50 rounded-lg border border-red-200';
            fixDiv.innerHTML = `<strong>${failure.category}:</strong> ${failure.fix}`;
            fixRecommendations.appendChild(fixDiv);
          }
        }
      }

      async function runAllTests() {
        // Reset
        testResults = [];
        passCount = 0;
        failCount = 0;
        warnCount = 0;
        detailedResults.innerHTML = '';
        fixRecommendations.innerHTML = '';
        resultsSection.classList.remove('hidden');
        progressSection.classList.remove('hidden');

        const testAuth = document.getElementById('testAuth').checked;
        const testSupabase = document.getElementById('testSupabase').checked;
        const testTables = document.getElementById('testTables').checked;
        const testRealtime = document.getElementById('testRealtime').checked;
        const testStorage = document.getElementById('testStorage').checked;
        const testTeacher = document.getElementById('testTeacher').checked;
        const testParent = document.getElementById('testParent').checked;

        try {
          if (testAuth) await runAuthTests();
          if (testSupabase) {
            const connected = await runSupabaseTests();
            if (connected && testTables) await runTableTests(true);
          }
          if (testRealtime) await runRealtimeTests();
          if (testStorage) await runStorageTests();
          if (testTeacher) await runTeacherFeatureTests();
          if (testParent) await runParentFeatureTests();

          // Update summary
          document.getElementById('passCount').textContent = passCount;
          document.getElementById('failCount').textContent = failCount;
          document.getElementById('warnCount').textContent = warnCount;

          // Generate recommendations
          generateRecommendations();

          updateProgress(100, 'Diagnostics complete!');
        } catch (e) {
          addResult('Diagnostics', 'Test Runner', 'fail', `Exception: ${e.message}`);
          updateProgress(100, 'Diagnostics failed');
        }

      document.getElementById('runTests').addEventListener('click', runAllTests);
    </script>
  </body>
</html>
