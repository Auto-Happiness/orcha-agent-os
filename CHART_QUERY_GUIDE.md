# Chart-Compatible Query Guide for Orcha Agent OS

## Overview

This guide explains how to create and configure SQL queries that work seamlessly with **Line**, **Bar**, and **Pie** charts in the Orcha Agent OS BI dashboard.

## Query Data Structure

All chart queries must return data in a specific format with exactly two types of columns:

### Required Columns:

1. **Label Column** (labelKey)
   - Contains categorical or time-based labels
   - Used for X-axis in line/bar charts, segments in pie charts
   - Examples: dates, country names, product categories, status values

2. **Value Columns** (valueKeys)
   - Contains numeric data
   - Used for Y-axis values in line/bar charts, segment sizes in pie charts
   - Examples: revenue, count, quantity, amount

### Query Template:

```sql
SELECT 
    [category_or_time_column] as label_name,
    SUM(numeric_value) as value_name_1,
    COUNT(*) as value_name_2
FROM 
    [table_name]
WHERE 
    [optional_filters]
GROUP BY 
    [category_or_time_column]
ORDER BY 
    [column] ASC|DESC;
```

## Chart Type Requirements

### Line Charts
- **Best Used For**: Time-series data, trends over time
- **Label Column**: Dates, months, quarters, or time periods
- **Value Columns**: 1-3 numeric values (trends to visualize)
- **Example Queries**: Monthly Sales Trend, Quarterly Revenue, Daily Order Count

```sql
-- MySQL Example: Monthly Revenue Trend
SELECT 
    DATE_FORMAT(o.orderDate, '%Y-%m') AS month,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue
FROM orders o
JOIN orderdetails od ON o.orderNumber = od.orderNumber
WHERE o.orderDate IS NOT NULL
GROUP BY DATE_FORMAT(o.orderDate, '%Y-%m')
ORDER BY month ASC;
```

### Bar Charts
- **Best Used For**: Comparisons between categories
- **Label Column**: Product names, countries, statuses, employees
- **Value Columns**: 1-3 numeric values for comparison
- **Example Queries**: Sales by Product Line, Revenue by Country, Orders by Status

```sql
-- MySQL Example: Sales by Product Line
SELECT 
    p.productLine,
    SUM(od.quantityOrdered) AS total_quantity,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS total_revenue
FROM products p
JOIN orderdetails od ON p.productCode = od.productCode
GROUP BY p.productLine
ORDER BY total_revenue DESC;
```

### Pie Charts
- **Best Used For**: Part-to-whole relationships
- **Label Column**: Category names (should be mutually exclusive)
- **Value Columns**: 1 numeric column (represents segments as percentages)
- **Example Queries**: Market Share, Status Distribution, Regional Breakdown

```sql
-- MySQL Example: Order Status Distribution
SELECT 
    o.status,
    COUNT(o.orderNumber) AS order_count
FROM orders o
GROUP BY o.status
ORDER BY order_count DESC;
```

## Dashboard Configuration Steps

### Step 1: Create/Save Your Query
1. Navigate to your database connection in the dashboard
2. Create a new saved query with your SQL
3. Save the query with a descriptive name

### Step 2: Add Widget to Dashboard
1. Click "Add Widget" in the BI dashboard
2. Select your chart type (Line, Bar, or Pie)
3. Give the widget a title

### Step 3: Configure Widget Mapping
1. **Select Data Source**: Choose your saved query
2. **Execute Query**: Preview the data returned
3. **Map Columns**:
   - **Label Key**: Select the categorical/time column (e.g., 'month')
   - **Value Keys**: Select numeric columns to display (e.g., 'revenue', 'count')
4. **Optional**: Choose color theme and styling
5. **Save**: Apply the configuration

## Common Mistakes to Avoid

❌ **Mixing categorical and numerical labels**
```sql
-- BAD: label column is numeric
SELECT o.orderNumber, SUM(od.quantityOrdered * od.priceEach) AS revenue 
FROM orders o 
JOIN orderdetails od ON o.orderNumber = od.orderNumber
GROUP BY o.orderNumber;
```

✅ **Proper label column (MySQL)**
```sql
-- GOOD: label column is categorical/temporal using MySQL DATE_FORMAT
SELECT 
    DATE_FORMAT(o.orderDate, '%Y-%m') AS month, 
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue 
FROM orders o
JOIN orderdetails od ON o.orderNumber = od.orderNumber
GROUP BY DATE_FORMAT(o.orderDate, '%Y-%m')
ORDER BY month ASC;
```

---

❌ **Null or missing values (MySQL)**
```sql
-- BAD: May return NULL values causing chart rendering issues
SELECT c.country, SUM(p.amount) AS total_paid
FROM customers c
LEFT JOIN payments p ON c.customerNumber = p.customerNumber
GROUP BY c.country;
```

✅ **Handle nulls explicitly (MySQL)**
```sql
-- GOOD: Use COALESCE or filter with IS NOT NULL
SELECT 
    COALESCE(c.country, 'Unknown') AS country,
    ROUND(SUM(COALESCE(p.amount, 0)), 2) AS total_paid
FROM customers c
LEFT JOIN payments p ON c.customerNumber = p.customerNumber
WHERE c.country IS NOT NULL
GROUP BY c.country
ORDER BY total_paid DESC;
```

---

❌ **Too many labels (pie charts in MySQL)**
```sql
-- BAD: Pie with 50+ segments is unreadable
SELECT p.productCode, ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue
FROM products p
JOIN orderdetails od ON p.productCode = od.productCode
GROUP BY p.productCode;
```

✅ **Limit segments for readability (MySQL)**
```sql
-- GOOD: Top 10 products + "Others" category
SELECT product_label, total_revenue FROM (
    SELECT 
        p.productName AS product_label,
        ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS total_revenue
    FROM products p
    JOIN orderdetails od ON p.productCode = od.productCode
    GROUP BY p.productCode, p.productName
    ORDER BY total_revenue DESC
    LIMIT 10
) top_10
UNION ALL
SELECT 
    'Others' AS product_label,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS total_revenue
FROM products p
JOIN orderdetails od ON p.productCode = od.productCode
WHERE p.productCode NOT IN (
    SELECT p2.productCode
    FROM products p2
    JOIN orderdetails od2 ON p2.productCode = od2.productCode
    GROUP BY p2.productCode
    ORDER BY SUM(od2.quantityOrdered * od2.priceEach) DESC
    LIMIT 10
)
GROUP BY 'Others';
```

## Performance Optimization Tips

### For Large Datasets:

1. **Use LIMIT for preview data (MySQL)**
   ```sql
   -- During testing, add MySQL LIMIT to speed up queries
   SELECT p.productLine, ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue
   FROM products p
   JOIN orderdetails od ON p.productCode = od.productCode
   GROUP BY p.productLine
   ORDER BY revenue DESC
   LIMIT 100;
   ```

2. **Add appropriate WHERE clauses (MySQL)**
   ```sql
   -- Filter to relevant date ranges using MySQL DATE_SUB
   WHERE o.orderDate >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
   ```

3. **Use aggregation indexes for MySQL**
   - Ensure columns used in GROUP BY have indexes
   - Create composite indexes: `CREATE INDEX idx_product_orders ON orderdetails(productCode, quantityOrdered);`
   - Use EXPLAIN to verify index usage: `EXPLAIN SELECT ... GROUP BY ...;`

4. **Pre-aggregate in MySQL views** (advanced)
   ```sql
   CREATE VIEW sales_by_month_mv AS
   SELECT 
       DATE_FORMAT(o.orderDate, '%Y-%m') AS month, 
       ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue,
       COUNT(DISTINCT o.orderNumber) AS order_count
   FROM orders o
   JOIN orderdetails od ON o.orderNumber = od.orderNumber
   GROUP BY DATE_FORMAT(o.orderDate, '%Y-%m');
   ```

## Real-World Examples

### Example 1: E-commerce Dashboard (MySQL)

**Query**: Revenue by Product Category Over Time
```sql
-- MySQL Query with DATE_FORMAT for temporal grouping
SELECT 
    CONCAT(DATE_FORMAT(o.orderDate, '%Y-%m'), ' - ', p.productLine) AS label,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS revenue
FROM orders o
JOIN orderdetails od ON o.orderNumber = od.orderNumber
JOIN products p ON od.productCode = p.productCode
WHERE o.orderDate >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
GROUP BY DATE_FORMAT(o.orderDate, '%Y-%m'), p.productLine
ORDER BY o.orderDate ASC;
```

**Chart Type**: Line Chart
- **labelKey**: `label` (contains both date and product line)
- **valueKeys**: [`revenue`]

---

### Example 2: Sales Team Performance (MySQL)

**Query**: Sales by Employee (Current Month)
```sql
-- MySQL Query for current month employee sales
SELECT 
    CONCAT(e.firstName, ' ', e.lastName) AS employee_name,
    COUNT(DISTINCT o.orderNumber) AS orders_count,
    ROUND(SUM(od.quantityOrdered * od.priceEach), 2) AS total_sales
FROM employees e
LEFT JOIN customers c ON e.employeeNumber = c.salesRepEmployeeNumber
LEFT JOIN orders o ON c.customerNumber = o.customerNumber 
    AND MONTH(o.orderDate) = MONTH(NOW())
    AND YEAR(o.orderDate) = YEAR(NOW())
LEFT JOIN orderdetails od ON o.orderNumber = od.orderNumber
GROUP BY e.employeeNumber, e.firstName, e.lastName
HAVING SUM(od.quantityOrdered * od.priceEach) > 0
ORDER BY total_sales DESC;
```

**Chart Types**: Bar Chart or Pie Chart
- **labelKey**: `employee_name`
- **valueKeys**: [`orders_count`, `total_sales`]

---

### Example 3: Inventory Analysis (MySQL)

**Query**: Stock Levels by Product Line
```sql
-- MySQL Query for inventory analysis
SELECT 
    p.productLine,
    COUNT(DISTINCT p.productCode) AS product_count,
    SUM(p.quantityInStock) AS total_stock,
    ROUND(AVG(p.quantityInStock), 2) AS avg_stock_per_product
FROM products p
GROUP BY p.productLine
ORDER BY total_stock DESC;
```

**Chart Types**: Bar Chart or Pie Chart
- **labelKey**: `productLine`
- **valueKeys**: [`product_count`, `total_stock`, `avg_stock_per_product`]

## Widget Configuration Summary

| Chart Type | Ideal Label | Ideal Values | Data Points | Use Case |
|-----------|-------------|--------------|-------------|----------|
| **Line** | Temporal (dates) | 1-3 trends | 12-52+ | Trends, forecasting |
| **Bar** | Categorical | 1-3 metrics | 3-10+ | Comparisons, rankings |
| **Pie** | Categorical | 1 metric | 3-8 | Part-to-whole, percentages |

## Debugging Failed Queries (MySQL)

If your query fails to render:

1. **Check MySQL SQL Syntax**
   - Validate using `EXPLAIN SELECT ...;` to see query execution plan
   - Use `SHOW TABLES;` to verify table existence
   - Use `DESCRIBE table_name;` to verify columns

2. **Verify Data Types (MySQL)**
   - Label column should be: VARCHAR, CHAR, DATE, DATETIME, or similar
   - Value columns should be: INT, DECIMAL, FLOAT, BIGINT, or similar
   - Use `CAST()` or `CONVERT()` if needed: `CAST(column AS CHAR)`

3. **Check for Nulls (MySQL)**
   - Use `IS NOT NULL` in WHERE clause
   - Use `COALESCE(column, 'default')` to provide defaults
   - MySQL Example: `COALESCE(c.country, 'Unknown')`

4. **Validate Result Set (MySQL)**
   - Execute query directly: `SELECT ... LIMIT 10;`
   - Check row count: `SELECT COUNT(*) FROM (...) AS subquery;`
   - Verify column values: `SELECT DISTINCT label_column FROM ...;`

5. **Check Column Naming (MySQL)**
   - Use `AS` to explicitly name columns (required for chart mapping)
   - Avoid spaces and special characters: use `total_revenue` not `total revenue`
   - Column names are case-insensitive in MySQL but use consistent casing
   - Check that labelKey and valueKeys match column aliases exactly

6. **MySQL-Specific Issues**
   - **GROUP BY Error**: Ensure all non-aggregated columns are in GROUP BY clause
   - **Date Issues**: Use `DATE_FORMAT(column, '%Y-%m')` for formatting
   - **Timeout**: Add `LIMIT` clause for large datasets: `LIMIT 1000`
   - **Performance**: Use `EXPLAIN` to check if indexes are being used

## Related Resources

- [DynamicChart Component](../components/BI/DynamicChart.tsx)
- [BI Dashboard Configuration](../app/[saas]/command-center/page.tsx)
- [Widget Intelligence Panel](../components/BI/WidgetIntelligencePanel.tsx)
- [Convex BI Functions](../convex/bi.ts)

## MySQL-Specific Functions Reference

Common MySQL functions used in chart queries:

| Function | Usage | Example |
|----------|-------|---------|
| `DATE_FORMAT()` | Format dates | `DATE_FORMAT(orderDate, '%Y-%m')` |
| `DATE_SUB()` | Subtract dates | `DATE_SUB(NOW(), INTERVAL 1 YEAR)` |
| `CONCAT()` | Combine strings | `CONCAT(firstName, ' ', lastName)` |
| `COALESCE()` | Handle nulls | `COALESCE(column, 'Unknown')` |
| `ROUND()` | Round decimals | `ROUND(amount, 2)` |
| `SUM()` | Sum values | `SUM(quantity)` |
| `COUNT()` | Count rows | `COUNT(DISTINCT orderNumber)` |
| `GROUP_CONCAT()` | Concatenate grouped values | `GROUP_CONCAT(productName)` |
| `CAST()/CONVERT()` | Type conversion | `CAST(value AS DECIMAL(10,2))` |
| `MONTH()/YEAR()/QUARTER()` | Extract date parts | `MONTH(orderDate)` |

## MySQL Query Performance Tips

- Use `EXPLAIN` before running aggregation queries on large tables
- Create indexes on frequently grouped columns: `CREATE INDEX idx_name ON table(column);`
- Use `LIMIT` during query development to speed up testing
- Avoid `SELECT *` in aggregation queries; select only needed columns
- Use `HAVING` clause to filter aggregated results instead of WHERE when possible

---

**Last Updated**: April 22, 2026
**Database**: MySQL 5.7+
**Compatible With**: Orcha Agent OS v1.0+
