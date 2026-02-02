# Fix Data Analytics and Integrate Python Logic

I will fix the data analytics dashboard to ensure time-range filtering works correctly and integrate the risk analysis logic from the Python `analytics_engine.py` script.

## Technical Implementation Plan

### 1. Fix Date Filtering Logic

* Update [admin-analytics.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-analytics.js) to ensure the `rangeStart` date is set to 00:00:00 (midnight) of the target day.

* Currently, filtering for "Last 7 days" or "Month" uses the current hour, which incorrectly excludes data from earlier in the starting day.

### 2. Port Python Risk Analysis Logic

* Implement the "Absence Rate" calculation in [admin-analytics.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/admin-analytics.js) to match [analytics\_engine.py](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/scripts/analytics_engine.py).

* **Logic**:

  * Track unique attendance days per student.

  * Calculate `absence_rate = (absences / total_days) * 100`.

  * Use the **15% threshold** defined in the Python script to identify high-risk students.

### 3. UI Enhancements in admin-analytics.html

* Update the "Critical Absences" section to display **Absence Rate %** instead of just counts.

* Add a new "Predictive Risk Analysis" badge to students exceeding the 15% threshold.

* Add an informational section or button explaining how to run the `scripts/analytics_engine.py` for advanced offline CSV reporting.

### 4. Robust Data Fetching

* Ensure `fetchAnalytics` handles potential null values in `timestamp` by falling back to the `date` column if necessary.

* Optimize the `select` query to ensure all required student metadata is retrieved for the risk analysis.

## Key Changes

* **JS**: Refactor `processAndRenderCharts` and `renderCriticalList`.

* **HTML**: Update section headers and add a "Python Integration" info box.

* **Python**: No changes needed to the script itself, but its logic will now be visible in the web dashboard.

## Verification

* Test the "Today", "Week", and "Month" filters to ensure data is correctly populated.

* Verify that students with high absence rates are flagged as "High Risk" in the dashboard.

