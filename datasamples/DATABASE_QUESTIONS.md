# 50+ SQL Questions for ClassicModels Database

## Overview
This document contains 50+ SQL questions based on the ClassicModels sample database. The questions are organized by difficulty level and cover various SQL concepts including SELECT, JOINs, aggregations, subqueries, and more.

---

## BASIC QUESTIONS (1-15)

### 1. Basic SELECT - Single Table
**List all product lines in the database.**
```sql
SELECT * FROM productlines;
```

### 2. Basic SELECT with WHERE
**Find all products with quantity in stock greater than 5000.**
```sql
SELECT productCode, productName, quantityInStock FROM products WHERE quantityInStock > 5000;
```

### 3. SELECT with ORDER BY
**Display all customers sorted by country and then by customerName.**
```sql
SELECT * FROM customers ORDER BY country, customerName;
```

### 4. COUNT Function
**How many products are in the "Classic Cars" product line?**
```sql
SELECT COUNT(*) FROM products WHERE productLine = 'Classic Cars';
```

### 5. DISTINCT Values
**What are all the different countries where we have offices?**
```sql
SELECT DISTINCT country FROM offices;
```

### 6. Basic Filtering with LIKE
**Find all products with "Ford" in their name.**
```sql
SELECT productCode, productName FROM products WHERE productName LIKE '%Ford%';
```

### 7. IN Operator
**List all products from the Motorcycles, Planes, or Ships product lines.**
```sql
SELECT * FROM products WHERE productLine IN ('Motorcycles', 'Planes', 'Ships');
```

### 8. BETWEEN Operator
**Find all products with a buy price between $50 and $100.**
```sql
SELECT productCode, productName, buyPrice FROM products WHERE buyPrice BETWEEN 50 AND 100;
```

### 9. NULL Check
**Find all orders where the shippedDate is NULL (not yet shipped).**
```sql
SELECT orderNumber, orderDate, requiredDate FROM orders WHERE shippedDate IS NULL;
```

### 10. Basic Aggregation - SUM
**What is the total quantity in stock across all products?**
```sql
SELECT SUM(quantityInStock) AS total_quantity FROM products;
```

### 11. Basic Aggregation - AVG
**What is the average buy price of all products?**
```sql
SELECT AVG(buyPrice) AS average_price FROM products;
```

### 12. Basic Aggregation - MIN and MAX
**What is the minimum and maximum MSRP (Manufacturer's Suggested Retail Price)?**
```sql
SELECT MIN(MSRP) AS min_price, MAX(MSRP) AS max_price FROM products;
```

### 13. GROUP BY with COUNT
**Count how many products are in each product line.**
```sql
SELECT productLine, COUNT(*) AS product_count FROM products GROUP BY productLine;
```

### 14. LIMIT Clause
**Get the top 5 most expensive products by MSRP.**
```sql
SELECT productCode, productName, MSRP FROM products ORDER BY MSRP DESC LIMIT 5;
```

### 15. String Functions
**Display the first name and last name of all employees in uppercase.**
```sql
SELECT UPPER(firstName) AS first_name, UPPER(lastName) AS last_name FROM employees;
```

---

## INTERMEDIATE QUESTIONS (16-35)

### 16. INNER JOIN - Two Tables
**List all orders with customer names.**
```sql
SELECT o.orderNumber, o.orderDate, c.customerName FROM orders o INNER JOIN customers c ON o.customerNumber = c.customerNumber;
```

### 17. LEFT JOIN
**Show all employees and their office location, including employees without assigned offices.**
```sql
SELECT e.employeeNumber, e.firstName, e.lastName, o.city FROM employees e LEFT JOIN offices o ON e.officeCode = o.officeCode;
```

### 18. Multiple JOINs
**Get order details including product name, quantity ordered, and customer name.**
```sql
SELECT od.orderNumber, p.productName, od.quantityOrdered, od.priceEach, c.customerName 
FROM orderdetails od 
JOIN products p ON od.productCode = p.productCode 
JOIN orders o ON od.orderNumber = o.orderNumber 
JOIN customers c ON o.customerNumber = c.customerNumber;
```

### 19. GROUP BY with HAVING
**Find product lines that have more than 10 products.**
```sql
SELECT productLine, COUNT(*) AS product_count FROM products GROUP BY productLine HAVING COUNT(*) > 10;
```

### 20. Subquery in WHERE
**Find customers whose credit limit is greater than the average credit limit.**
```sql
SELECT customerNumber, customerName, creditLimit FROM customers WHERE creditLimit > (SELECT AVG(creditLimit) FROM customers);
```

### 21. UNION Operator
**Get a list of all cities from either offices or customers (no duplicates).**
```sql
SELECT city FROM offices UNION SELECT city FROM customers;
```

### 22. Self-Join - Employee Hierarchy
**List all employees and their direct manager.**
```sql
SELECT e.employeeNumber, e.firstName, e.lastName, m.firstName AS manager_first_name, m.lastName AS manager_last_name 
FROM employees e 
LEFT JOIN employees m ON e.reportsTo = m.employeeNumber;
```

### 23. Date Functions
**Find all orders placed in 2003.**
```sql
SELECT orderNumber, orderDate FROM orders WHERE YEAR(orderDate) = 2003;
```

### 24. GROUP BY with SUM and JOIN
**Calculate total sales by product line.**
```sql
SELECT p.productLine, SUM(od.quantityOrdered * od.priceEach) AS total_sales 
FROM orderdetails od 
JOIN products p ON od.productCode = p.productCode 
GROUP BY p.productLine;
```

### 25. GROUP BY with Multiple Columns
**Show total sales amount by customer and order date.**
```sql
SELECT c.customerName, o.orderDate, SUM(od.quantityOrdered * od.priceEach) AS order_total 
FROM customers c 
JOIN orders o ON c.customerNumber = o.customerNumber 
JOIN orderdetails od ON o.orderNumber = od.orderNumber 
GROUP BY c.customerNumber, o.orderDate;
```

### 26. CASE Statement
**Categorize products by price range: Budget (<$50), Mid-range ($50-$100), Premium (>$100).**
```sql
SELECT productName, buyPrice,
CASE 
  WHEN buyPrice < 50 THEN 'Budget'
  WHEN buyPrice BETWEEN 50 AND 100 THEN 'Mid-range'
  ELSE 'Premium'
END AS price_category
FROM products;
```

### 27. ORDER BY with Multiple Columns
**List customers ordered by country (ascending) and then by credit limit (descending).**
```sql
SELECT customerName, country, creditLimit FROM customers ORDER BY country ASC, creditLimit DESC;
```

### 28. Aggregate Function with ROUND
**Show each product with its buy price and the profit margin (MSRP - buyPrice) rounded to 2 decimals.**
```sql
SELECT productCode, productName, buyPrice, MSRP, ROUND(MSRP - buyPrice, 2) AS profit_margin FROM products;
```

### 29. WHERE with AND/OR
**Find all products from Classic Cars or Vintage Cars that cost more than $75 to buy.**
```sql
SELECT productCode, productName, productLine, buyPrice FROM products 
WHERE (productLine = 'Classic Cars' OR productLine = 'Vintage Cars') AND buyPrice > 75;
```

### 30. DISTINCT with WHERE
**Find all unique countries that have customers with credit limit over $100,000.**
```sql
SELECT DISTINCT country FROM customers WHERE creditLimit > 100000;
```

### 31. COUNT with GROUP BY and ORDER BY
**List the number of customers per country, sorted by count descending.**
```sql
SELECT country, COUNT(*) AS customer_count FROM customers GROUP BY country ORDER BY customer_count DESC;
```

### 32. JOIN with GROUP BY and Aggregate
**Show which sales representative (employee) has the highest total sales.**
```sql
SELECT e.employeeNumber, e.firstName, e.lastName, SUM(od.quantityOrdered * od.priceEach) AS total_sales
FROM employees e
JOIN customers c ON e.employeeNumber = c.salesRepEmployeeNumber
JOIN orders o ON c.customerNumber = o.customerNumber
JOIN orderdetails od ON o.orderNumber = od.orderNumber
GROUP BY e.employeeNumber
ORDER BY total_sales DESC
LIMIT 1;
```

### 33. Subquery in FROM Clause
**Get the average order value and show orders that are above average.**
```sql
SELECT * FROM (
  SELECT o.orderNumber, SUM(od.quantityOrdered * od.priceEach) AS order_value
  FROM orders o
  JOIN orderdetails od ON o.orderNumber = od.orderNumber
  GROUP BY o.orderNumber
) AS order_values
WHERE order_value > (SELECT AVG(order_value) FROM (/* same subquery */));
```

### 34. IN with Subquery
**Find all products that have been ordered by customers in the USA.**
```sql
SELECT DISTINCT p.productCode, p.productName
FROM products p
WHERE p.productCode IN (
  SELECT od.productCode
  FROM orderdetails od
  JOIN orders o ON od.orderNumber = o.orderNumber
  JOIN customers c ON o.customerNumber = c.customerNumber
  WHERE c.country = 'USA'
);
```

### 35. Multiple Aggregate Functions
**For each product, show quantity in stock, average price at which it's been ordered, and total units ordered.**
```sql
SELECT p.productCode, p.productName, p.quantityInStock, AVG(od.priceEach) AS avg_sold_price, SUM(od.quantityOrdered) AS total_units_ordered
FROM products p
LEFT JOIN orderdetails od ON p.productCode = od.productCode
GROUP BY p.productCode;
```

---

## ADVANCED QUESTIONS (36-50)

### 36. Window Function (ROW_NUMBER)
**Rank customers by total purchase amount.**
```sql
SELECT c.customerNumber, c.customerName, SUM(od.quantityOrdered * od.priceEach) AS total_purchases,
ROW_NUMBER() OVER (ORDER BY SUM(od.quantityOrdered * od.priceEach) DESC) AS purchase_rank
FROM customers c
LEFT JOIN orders o ON c.customerNumber = o.customerNumber
LEFT JOIN orderdetails od ON o.orderNumber = od.orderNumber
GROUP BY c.customerNumber
ORDER BY purchase_rank;
```

### 37. Complex Multi-Table JOIN with Conditions
**Get all orders from USA customers, including order details, product info, and payment info.**
```sql
SELECT c.customerName, o.orderNumber, o.orderDate, p.productName, od.quantityOrdered, od.priceEach, py.amount, py.paymentDate
FROM customers c
JOIN orders o ON c.customerNumber = o.customerNumber
JOIN orderdetails od ON o.orderNumber = od.orderNumber
JOIN products p ON od.productCode = p.productCode
LEFT JOIN payments py ON c.customerNumber = py.customerNumber
WHERE c.country = 'USA'
ORDER BY o.orderDate;
```

### 38. Nested Subqueries
**Find the highest selling product in the most profitable product line.**
```sql
SELECT productCode, productName, SUM(od.quantityOrdered * od.priceEach) AS total_sales
FROM products p
JOIN orderdetails od ON p.productCode = od.productCode
WHERE p.productLine = (
  SELECT productLine FROM (
    SELECT productLine, SUM(od.quantityOrdered * (od.priceEach - p.buyPrice)) AS profit
    FROM orderdetails od
    JOIN products p ON od.productCode = p.productCode
    GROUP BY p.productLine
    ORDER BY profit DESC
    LIMIT 1
  ) AS top_line
)
GROUP BY productCode
ORDER BY total_sales DESC
LIMIT 1;
```

### 39. HAVING with Multiple Aggregate Functions
**Show product lines with both an average product cost over $50 and more than 5 products.**
```sql
SELECT productLine, COUNT(*) AS product_count, AVG(buyPrice) AS avg_cost
FROM products
GROUP BY productLine
HAVING COUNT(*) > 5 AND AVG(buyPrice) > 50;
```

### 40. Correlated Subquery
**For each customer, find their highest value order.**
```sql
SELECT c.customerNumber, c.customerName, 
(SELECT orderNumber FROM orders o 
 JOIN orderdetails od ON o.orderNumber = od.orderNumber 
 WHERE o.customerNumber = c.customerNumber 
 GROUP BY o.orderNumber 
 ORDER BY SUM(od.quantityOrdered * od.priceEach) DESC 
 LIMIT 1) AS highest_value_order
FROM customers c;
```

### 41. EXISTS Operator
**Find all products that have been ordered at least once.**
```sql
SELECT productCode, productName
FROM products p
WHERE EXISTS (
  SELECT 1 FROM orderdetails od WHERE od.productCode = p.productCode
);
```

### 42. NOT EXISTS Operator
**Find all customers who have never placed an order.**
```sql
SELECT customerNumber, customerName
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customerNumber = c.customerNumber
);
```

### 43. Complex Aggregate with CASE
**Show sales statistics for each office with breakdown by order status.**
```sql
SELECT o.city,
COUNT(CASE WHEN ord.status = 'Shipped' THEN 1 END) AS shipped_orders,
COUNT(CASE WHEN ord.status = 'On Hold' THEN 1 END) AS held_orders,
COUNT(CASE WHEN ord.status = 'Cancelled' THEN 1 END) AS cancelled_orders,
COUNT(CASE WHEN ord.status = 'Disputed' THEN 1 END) AS disputed_orders
FROM offices o
LEFT JOIN employees e ON o.officeCode = e.officeCode
LEFT JOIN customers c ON e.employeeNumber = c.salesRepEmployeeNumber
LEFT JOIN orders ord ON c.customerNumber = ord.customerNumber
GROUP BY o.city;
```

### 44. UNION with ORDER BY
**Show all contact names (both customer and employee contacts) with their type.**
```sql
SELECT CONCAT(firstName, ' ', lastName) AS contact_name, 'Customer' AS contact_type
FROM customers
UNION ALL
SELECT CONCAT(firstName, ' ', lastName) AS contact_name, 'Employee' AS contact_type
FROM employees
ORDER BY contact_name;
```

### 45. Recursive Check - Top Customers by Multiple Metrics
**Find top 10 customers by a composite score (order count + total purchase amount + average order value).**
```sql
SELECT c.customerNumber, c.customerName,
COUNT(DISTINCT o.orderNumber) AS order_count,
SUM(od.quantityOrdered * od.priceEach) AS total_purchases,
AVG(od.quantityOrdered * od.priceEach / COUNT(DISTINCT o.orderNumber)) AS avg_order_value,
(COUNT(DISTINCT o.orderNumber) * 0.3) + 
(SUM(od.quantityOrdered * od.priceEach) / 1000 * 0.5) + 
(AVG(od.quantityOrdered * od.priceEach) / 100 * 0.2) AS composite_score
FROM customers c
LEFT JOIN orders o ON c.customerNumber = o.customerNumber
LEFT JOIN orderdetails od ON o.orderNumber = od.orderNumber
GROUP BY c.customerNumber
ORDER BY composite_score DESC
LIMIT 10;
```

### 46. Date-Based Analysis with Complex Logic
**Show monthly sales trends for 2003 (total sales by month), including month-over-month change.**
```sql
SELECT MONTH(o.orderDate) AS month, YEAR(o.orderDate) AS year, 
SUM(od.quantityOrdered * od.priceEach) AS monthly_sales,
LAG(SUM(od.quantityOrdered * od.priceEach)) OVER (ORDER BY MONTH(o.orderDate)) AS previous_month_sales
FROM orders o
JOIN orderdetails od ON o.orderNumber = od.orderNumber
WHERE YEAR(o.orderDate) = 2003
GROUP BY MONTH(o.orderDate);
```

### 47. Inventory Analysis
**Identify products below reorder level (quantityInStock < 1000) that should be restocked, ranked by urgency.**
```sql
SELECT productCode, productName, productLine, quantityInStock,
buyPrice, quantityInStock * buyPrice AS inventory_value,
1000 - quantityInStock AS units_to_reorder,
RANK() OVER (ORDER BY quantityInStock ASC) AS urgency_rank
FROM products
WHERE quantityInStock < 1000
ORDER BY urgency_rank;
```

### 48. Customer Segmentation by Spending
**Segment customers into categories (High Value, Mid Value, Low Value) based on total spending.**
```sql
SELECT c.customerNumber, c.customerName, c.country,
SUM(od.quantityOrdered * od.priceEach) AS total_spending,
CASE 
  WHEN SUM(od.quantityOrdered * od.priceEach) > 100000 THEN 'High Value'
  WHEN SUM(od.quantityOrdered * od.priceEach) > 50000 THEN 'Mid Value'
  ELSE 'Low Value'
END AS customer_segment
FROM customers c
LEFT JOIN orders o ON c.customerNumber = o.customerNumber
LEFT JOIN orderdetails od ON o.orderNumber = od.orderNumber
GROUP BY c.customerNumber
ORDER BY total_spending DESC;
```

### 49. Product Performance Comparison
**Compare products within each product line to show which are top performers and which are lagging.**
```sql
SELECT p.productLine, p.productCode, p.productName,
SUM(od.quantityOrdered) AS units_sold,
SUM(od.quantityOrdered * od.priceEach) AS total_revenue,
RANK() OVER (PARTITION BY p.productLine ORDER BY SUM(od.quantityOrdered * od.priceEach) DESC) AS performance_rank
FROM products p
LEFT JOIN orderdetails od ON p.productCode = od.productCode
GROUP BY p.productCode, p.productLine
ORDER BY p.productLine, performance_rank;
```

### 50. Sales Team Performance Analysis
**Analyze sales representatives' performance including order metrics, customer metrics, and revenue.**
```sql
SELECT e.employeeNumber, e.firstName, e.lastName, e.jobTitle,
COUNT(DISTINCT c.customerNumber) AS customer_count,
COUNT(DISTINCT o.orderNumber) AS order_count,
SUM(od.quantityOrdered * od.priceEach) AS total_revenue,
AVG(od.quantityOrdered * od.priceEach) AS avg_order_value,
COUNT(DISTINCT CASE WHEN ord.status = 'Shipped' THEN o.orderNumber END) AS shipped_orders
FROM employees e
LEFT JOIN customers c ON e.employeeNumber = c.salesRepEmployeeNumber
LEFT JOIN orders o ON c.customerNumber = o.customerNumber
LEFT JOIN orders ord ON o.orderNumber = ord.orderNumber
LEFT JOIN orderdetails od ON o.orderNumber = od.orderNumber
WHERE e.jobTitle LIKE '%Sales%'
GROUP BY e.employeeNumber
ORDER BY total_revenue DESC;
```

---

## BONUS CHALLENGE QUESTIONS (51-55)

### 51. Complex Temporal Analysis
**Find the fastest growing product lines month-over-month in 2003.**
```sql
-- Advanced: Compare sales growth across months
SELECT productLine, MONTH(orderDate) AS month, SUM(quantityOrdered * priceEach) AS monthly_sales
FROM products p
JOIN orderdetails od ON p.productCode = od.productCode
JOIN orders o ON od.orderNumber = o.orderNumber
WHERE YEAR(o.orderDate) = 2003
GROUP BY p.productLine, MONTH(o.orderDate);
```

### 52. Payment Analysis with Aging
**Show payment aging report - how many days between order date and payment date.**
```sql
SELECT c.customerName, o.orderNumber, o.orderDate, py.paymentDate,
DATEDIFF(py.paymentDate, o.orderDate) AS days_to_payment,
CASE 
  WHEN DATEDIFF(py.paymentDate, o.orderDate) <= 30 THEN 'Prompt (0-30 days)'
  WHEN DATEDIFF(py.paymentDate, o.orderDate) <= 60 THEN 'Normal (31-60 days)'
  WHEN DATEDIFF(py.paymentDate, o.orderDate) <= 90 THEN 'Slow (61-90 days)'
  ELSE 'Very Slow (90+ days)'
END AS payment_category
FROM customers c
JOIN orders o ON c.customerNumber = o.customerNumber
JOIN payments py ON c.customerNumber = py.customerNumber
ORDER BY days_to_payment DESC;
```

### 53. Inventory vs. Sales Gap Analysis
**Compare inventory levels to sales velocity to identify overstocking and understocking.**
```sql
SELECT p.productCode, p.productName, p.quantityInStock,
SUM(od.quantityOrdered) AS annual_sales,
ROUND(p.quantityInStock / (SUM(od.quantityOrdered) / 12), 2) AS months_of_inventory,
CASE 
  WHEN (p.quantityInStock / (SUM(od.quantityOrdered) / 12)) > 6 THEN 'Overstocked'
  WHEN (p.quantityInStock / (SUM(od.quantityOrdered) / 12)) < 1 THEN 'Understocked'
  ELSE 'Optimal'
END AS inventory_status
FROM products p
LEFT JOIN orderdetails od ON p.productCode = od.productCode
GROUP BY p.productCode
ORDER BY inventory_status, months_of_inventory;
```

### 54. Geographic Performance Analysis
**Analyze performance metrics by geographic region combining office and customer data.**
```sql
SELECT o.country, o.territory, COUNT(DISTINCT c.customerNumber) AS customer_count,
COUNT(DISTINCT ord.orderNumber) AS order_count,
SUM(od.quantityOrdered * od.priceEach) AS total_sales,
AVG(c.creditLimit) AS avg_customer_credit,
COUNT(DISTINCT e.employeeNumber) AS employee_count
FROM offices o
LEFT JOIN employees e ON o.officeCode = e.officeCode
LEFT JOIN customers c ON e.employeeNumber = c.salesRepEmployeeNumber
LEFT JOIN orders ord ON c.customerNumber = ord.customerNumber
LEFT JOIN orderdetails od ON ord.orderNumber = od.orderNumber
GROUP BY o.country, o.territory
ORDER BY total_sales DESC;
```

### 55. Product Profitability with Market Share
**Calculate product profitability and market share within each product line.**
```sql
SELECT p.productLine, p.productCode, p.productName,
SUM(od.quantityOrdered * (od.priceEach - p.buyPrice)) AS total_profit,
SUM(od.quantityOrdered) AS units_sold,
ROUND(100 * SUM(od.quantityOrdered) / SUM(SUM(od.quantityOrdered)) OVER (PARTITION BY p.productLine), 2) AS market_share_pct,
ROUND(SUM(od.quantityOrdered * od.priceEach) / SUM(SUM(od.quantityOrdered * od.priceEach)) OVER (PARTITION BY p.productLine) * 100, 2) AS revenue_share_pct
FROM products p
LEFT JOIN orderdetails od ON p.productCode = od.productCode
GROUP BY p.productCode, p.productLine
ORDER BY p.productLine, total_profit DESC;
```

---

## Question Difficulty Summary

- **Basic (1-15)**: Focus on fundamental SQL operations including SELECT, WHERE, ORDER BY, GROUP BY, and simple aggregations
- **Intermediate (16-35)**: Introduce JOINs, subqueries, multiple aggregations, and CASE statements
- **Advanced (36-50)**: Complex queries with window functions, correlated subqueries, EXISTS, and multi-table joins
- **Bonus Challenge (51-55)**: Real-world business analysis scenarios with complex logic and temporal analysis

## Database Context

The ClassicModels database contains information about a retailer's operations:
- **Products**: Collectible car, motorcycle, plane, ship, train, truck and bus models with pricing
- **Customers**: Order placement and credit limit tracking
- **Orders & OrderDetails**: Complete order transaction records
- **Employees**: Organizational structure with manager hierarchies
- **Offices**: Geographic distribution of the business
- **Payments**: Payment transaction history
