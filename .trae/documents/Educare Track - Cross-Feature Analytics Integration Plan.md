# EDUCARE TRACK - Cross-Feature Analytics Integration Plan

## 1. Clinic Analytics (Health & Sickness Trends)
I will implement a new "Clinic Insights" view to help medical staff track school-wide health trends:
-   **New UI Section**: Add an "Analytics" navigation item and dashboard view in [clinic-dashboard.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/clinic-dashboard.html).
-   **Reason Distribution**: A doughnut chart showing common visit reasons (e.g., Fever, Headache, Injury).
-   **Trend Analysis**: A line chart showing visit frequency over the last 7 days to detect potential outbreaks.
-   **Grade-Level Heatmap**: Identify which grade levels are visiting the clinic most frequently.

## 2. Teacher Analytics (Classroom Performance)
I will refine the teacher's dashboard to provide actionable classroom data:
-   **Risk Monitor**: Update [teacher-dashboard.js](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/js/teacher-dashboard.js) to highlight "At-Risk" students (those with 3+ absences or lates in a week).
-   **Performance Trends**: A bar chart comparing attendance rates across different subject sessions.
-   **Student Recognition**: Automatically list students with 100% on-time attendance for the current month.

## 3. Guard & Gatekeeper Analytics (Late Monitor)
I will provide guards and gatekeeper teachers with a specialized "Late Monitor" to manage arrival bottlenecks:
-   **Top Late Students**: A real-time ranked list in [guard-dashboard.html](file:///c:/Users/Lenovo/Desktop/Educare%20Track%20-%20FINAL/pages/guard-dashboard.html) showing students who arrive late most frequently.
-   **Arrival Stats**: Comparison cards showing "Lates Today" vs "Weekly Average".
-   **Quick Insights**: Highlight the busiest 15-minute window during morning arrivals to help with staff positioning.

## 4. Technical Implementation
-   **Library**: Ensure [Chart.js](https://cdn.jsdelivr.net/npm/chart.js) is properly linked in all dashboard pages.
-   **Data Aggregation**: Implement efficient Supabase queries to fetch aggregates for specific timeframes (Daily, Weekly, Monthly).
-   **Responsiveness**: Ensure all new charts and data lists are fully responsive for mobile/tablet use.

I will start by adding the Analytics UI to the Clinic dashboard. Shall I proceed?