-- ============================================================================
-- CHART-COMPATIBLE QUERIES FOR BI DASHBOARDS (MySQL 5.7+)
-- Compatible with: LINE, BAR, and PIE charts
-- Database: MySQL / MariaDB
-- ============================================================================
-- 
-- IMPORTANT: All queries must return data with this structure:
-- - One column for labels/categories (labelKey)
-- - One or more columns for numeric values (valueKeys)
--
-- Example mapping:
--   labelKey: "category_name" or "date" 
--   valueKeys: ["amount", "count", "revenue"]
--
-- MySQL Functions Used:
--   - DATE_FORMAT(): Format dates for labels
--   - DATE_SUB(): Date calculations
--   - CONCAT(): String concatenation
--   - ROUND(): Decimal rounding
--   - GROUP_CONCAT(): Aggregate strings
--
-- ============================================================================

-- ============================================================================
-- 1. SALES BY PRODUCT LINE (Bar & Pie Charts)
-- ============================================================================
-- Description: Total quantity ordered and revenue by product line
-- Best for: Bar Chart, Pie Chart
-- Mapping: labelKey = 'productLine', valueKeys = ['totalQuantity', 'totalRevenue']
--
SELECT 
    p.productLine,
    SUM(od.quantityOrdered) as totalQuantity,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) as totalRevenue
FROM 
    orderdetails od
    JOIN products p ON od.productCode = p.productCode
GROUP BY 
    p.productLine
ORDER BY 
    totalRevenue DESC;

-- ============================================================================
-- 2. MONTHLY SALES TREND (Line Chart)
-- ============================================================================
-- Description: Monthly revenue trend over time
-- Best for: Line Chart
-- Mapping: labelKey = 'month', valueKeys = ['revenue', 'orderCount']
--
SELECT 
    DATE_FORMAT(o.orderDate, '%Y-%m') as month,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) as revenue,
    COUNT(DISTINCT o.orderNumber) as orderCount
FROM 
    orders o
    JOIN orderdetails od ON o.orderNumber = od.orderNumber
WHERE 
    o.orderDate IS NOT NULL
GROUP BY 
    DATE_FORMAT(o.orderDate, '%Y-%m')
ORDER BY 
    month ASC;

-- ============================================================================
-- 3. ORDER STATUS DISTRIBUTION (Pie & Bar Charts)
-- ============================================================================
-- Description: Count of orders by status
-- Best for: Pie Chart, Bar Chart
-- Mapping: labelKey = 'status', valueKeys = ['orderCount']
--
SELECT 
    status,
    COUNT(orderNumber) as orderCount
FROM 
    orders
GROUP BY 
    status
ORDER BY 
    orderCount DESC;

-- ============================================================================
-- 4. REVENUE BY COUNTRY (Bar & Pie Charts)
-- ============================================================================
-- Description: Total revenue per country
-- Best for: Bar Chart, Pie Chart
-- Mapping: labelKey = 'country', valueKeys = ['totalRevenue', 'orderCount']
--
SELECT 
    c.country,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) as totalRevenue,
    COUNT(DISTINCT o.orderNumber) as orderCount
FROM 
    customers c
    JOIN orders o ON c.customerNumber = o.customerNumber
    JOIN orderdetails od ON o.orderNumber = od.orderNumber
GROUP BY 
    c.country
ORDER BY 
    totalRevenue DESC;

-- ============================================================================
-- 5. TOP PRODUCTS BY QUANTITY (Bar & Pie Charts)
-- ============================================================================
-- Description: Top 10 products by quantity ordered
-- Best for: Bar Chart, Pie Chart
-- Mapping: labelKey = 'productName', valueKeys = ['quantityOrdered', 'revenue']
--
SELECT 
    p.productName,
    SUM(od.quantityOrdered) as quantityOrdered,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) as revenue
FROM 
    orderdetails od
    JOIN products p ON od.productCode = p.productCode
GROUP BY 
    p.productCode, p.productName
ORDER BY 
    quantityOrdered DESC
LIMIT 10;

-- ============================================================================
-- 6. QUARTERLY REVENUE TREND (Line Chart)
-- ============================================================================
-- Description: Quarterly revenue comparison
-- Best for: Line Chart
-- Mapping: labelKey = 'quarter', valueKeys = ['revenue']
--
SELECT 
    CONCAT(YEAR(o.orderDate), '-Q', QUARTER(o.orderDate)) as quarter,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) as revenue
FROM 
    orders o
    JOIN orderdetails od ON o.orderNumber = od.orderNumber
WHERE 
    o.orderDate IS NOT NULL
GROUP BY 
    YEAR(o.orderDate), QUARTER(o.orderDate)
ORDER BY 
    YEAR(o.orderDate), QUARTER(o.orderDate);

-- ============================================================================
-- 7. CUSTOMER SEGMENTATION BY PAYMENT VOLUME (Bar & Pie Charts)
-- ============================================================================
-- Description: Number of customers in different payment volume segments
-- Best for: Bar Chart, Pie Chart
-- Mapping: labelKey = 'segment', valueKeys = ['customerCount', 'totalPayment']
--
SELECT 
    CASE 
        WHEN totalPayment > 100000 THEN 'High Volume'
        WHEN totalPayment > 50000 THEN 'Medium Volume'
        ELSE 'Low Volume'
    END as segment,
    COUNT(*) as customerCount,
    ROUND(SUM(totalPayment), 2) as totalPayment
FROM (
    SELECT 
        c.customerNumber,
        SUM(p.amount) as totalPayment
    FROM 
        customers c
        LEFT JOIN payments p ON c.customerNumber = p.customerNumber
    GROUP BY 
        c.customerNumber
) customer_payments
GROUP BY 
    segment
ORDER BY 
    totalPayment DESC;

-- ============================================================================
-- 8. DAILY ORDER COUNT TREND (Line Chart)
-- ============================================================================
-- Description: Daily order trends over time
-- Best for: Line Chart
-- Mapping: labelKey = 'orderDate', valueKeys = ['orderCount', 'totalAmount']
--
SELECT 
    DATE_FORMAT(o.orderDate, '%Y-%m-%d') as orderDate,
    COUNT(DISTINCT o.orderNumber) as orderCount,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) as totalAmount
FROM 
    orders o
    JOIN orderdetails od ON o.orderNumber = od.orderNumber
WHERE 
    o.orderDate IS NOT NULL
GROUP BY 
    DATE_FORMAT(o.orderDate, '%Y-%m-%d')
ORDER BY 
    orderDate ASC;

-- ============================================================================
-- 9. EMPLOYEES BY OFFICE (Bar & Pie Charts)
-- ============================================================================
-- Description: Number of employees per office
-- Best for: Bar Chart, Pie Chart
-- Mapping: labelKey = 'city', valueKeys = ['employeeCount']
--
SELECT 
    CONCAT(o.city, ', ', o.country) as city,
    COUNT(e.employeeNumber) as employeeCount
FROM 
    offices o
    LEFT JOIN employees e ON o.officeCode = e.officeCode
GROUP BY 
    o.officeCode, o.city, o.country
ORDER BY 
    employeeCount DESC;

-- ============================================================================
-- 10. PRODUCT SCALE DISTRIBUTION (Pie & Bar Charts)
-- ============================================================================
-- Description: Distribution of products by scale
-- Best for: Pie Chart, Bar Chart
-- Mapping: labelKey = 'productScale', valueKeys = ['productCount', 'totalQuantityOrdered']
--
SELECT 
    p.productScale,
    COUNT(DISTINCT p.productCode) as productCount,
    ROUND(SUM(od.quantityOrdered), 0) as totalQuantityOrdered
FROM 
    products p
    LEFT JOIN orderdetails od ON p.productCode = od.productCode
GROUP BY 
    p.productScale
ORDER BY 
    totalQuantityOrdered DESC;

-- ============================================================================
-- MYSQL NOTES FOR DASHBOARD CONFIGURATION:
-- ============================================================================
--
-- When configuring widgets in the BI dashboard:
--
-- For LINE Charts (Time-Series with MySQL DATE_FORMAT):
--   - Use DATE_FORMAT() with '%Y-%m' for monthly, '%Y-%m-%d' for daily
--   - MySQL temporal labels (dates, months, quarters)
--   - Typically 1-2 value columns
--   - Best for showing trends over time
--   - Example Queries: #2 (Monthly Trend), #6 (Quarterly), #8 (Daily)
--   - ORDER BY month/quarter/date ASC for proper sequencing
--
-- For BAR Charts (Categorical Comparisons):
--   - Use categorical labels (product names, countries, statuses)
--   - Can have multiple value columns (2-3 metrics per category)
--   - Good for comparisons and rankings
--   - ORDER BY value DESC to show top performers
--   - Example Queries: #1, #3, #4, #5, #7, #9, #10
--
-- For PIE Charts (Part-to-Whole with MySQL):
--   - Use 1 numeric value column (represents segments as percentages)
--   - Values should sum to meaningful total (100%, revenue, etc.)
--   - Limit to 3-8 segments for readability
--   - Shows part-to-whole relationships clearly
--   - Example Queries: #1, #3, #7, #10
--
-- MySQL Query Performance Tips:
--   - Use EXPLAIN to check query execution plans: EXPLAIN SELECT ...;
--   - Add indexes on GROUP BY columns for large tables
--   - Use LIMIT during development: SELECT ... GROUP BY ... LIMIT 100;
--   - Date-based filtering improves performance: WHERE date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
--   - Use DESCRIBE to verify table structure: DESCRIBE orders;
--
-- Column Naming (Important for Chart Mapping):
--   - Use meaningful aliases: AS month, AS country, AS revenue
--   - Dashboard maps: labelKey = 'month', valueKeys = ['revenue', 'count']
--   - Column names are case-insensitive in MySQL but use consistent naming
--   - Avoid special characters and spaces in column names
--
-- ============================================================================
