# Semantic Modeling in Orcha Agent OS 🌌

## ❓ What is Semantic Modeling?
Semantic modeling is the process of creating a **human-readable** and **context-aware** layer over your raw data. It translates the physical storage of data (tables, columns, types) into meaningful business concepts (Customers, Revenue, Active Subscriptions). 

In Orcha, this layer serves as the "Common Language" that allows AI agents to interact with your database without needing to understand complex SQL joins or cryptic column names.

## 🎯 Why use Semantic Modeling?
- **AI Accuracy**: LLMs perform significantly better when they interact with clearly named "Entities" rather than raw DB schemas.
- **Single Source of Truth**: Define your business logic (e.g., how "Gross Margin" is calculated) once in the semantic layer, ensuring every AI tool uses the same definition.
- **Governance & Security**: You decide which fields are exposed to the AI, adding a layer of data privacy and access control.
- **Protocol Standardization**: By modeling semantically, your data becomes instantly compatible with the **Model Context Protocol (MCP)**, allowing it to be used across any AI agent ecosystem.

---

## 🔍 The "SQL Gap"
AI agents struggle with typical database realities:
- **Cryptic Names**: Tables like `USR_MT_01` (Physical) vs `Customers` (Semantic).
- **Complex Joins**: Needing to join multiple tables just to find "Top Spenders."
- **Hidden Logic**: Raw tables don't explain if "Total Price" includes tax or shipping.

---
 
---

## 🛠️ How it Works in Orcha

### 1. Model Discovery
Orcha introspects your database and identifies tables. You then elevate these into **Semantic Models**.

### 2. Dimensions vs. Measures
- **Dimensions**: Attributes used to group or filter (e.g., `City`, `Product Tier`).
- **Measures**: Calculated quantitative values (e.g., `Total Profit` = `SUM(price - cost)`).

### 3. Relationships
Define JOIN logic once. For example, **Orders** relates to **Customers** on `user_id`. The AI will now automatically understand how to filter orders by customer location.

### 4. Vector Context
Orcha embeds these semantic definitions into a vector database. When you ask a question like "Who are my VIPs?", Orcha uses vector search to find the `Customer` model and the `VIP_Status` dimension.

---

## 🚀 MCP Integration
Your semantic models are instantly exposed via **Model Context Protocol (MCP)**. This allows the Orcha Chat Agent to:
1. **Discover** what your business data contains.
2. **Contextualize** your natural language questions.
3. **Execute** precise, high-performance queries without you writing a single line of SQL.
---

## 📱 How to Manage Semantic Models in the App

This section provides a step-by-step guide on using the **Semantic Modeler** within the Orcha Agent OS interface.

### 1. Navigating to the Modeler
1. From your dashboard, select an **Environment** (Database Configuration).
2. Click on the **Configure** button to enter the setup page.
3. Select the **Semantic Modeler** tab.

### 2. Selecting and Renaming Models
- The left sidebar lists all tables selected during connection.
- Click a table to load its field editor.
- **Business Name**: Rename the physical table (e.g., `tbl_user_v2`) to a readable name (e.g., `Customers`). This is what the AI will use to identify the entity.

### 3. Mastering Dimensions and Measures

Each field in your model must be classified to help the AI understand how to query it.

#### **A. Dimensions (The "By" Fields)**
- **What**: Attributes used to group, filter, or categorize data.
- **Examples**: `Order Date`, `City`, `Product Category`, `Customer Email`.
- **How to manage**: Select **Dimension** in the "Type" dropdown.

#### **B. Measures (The "Calculated" Fields)**
- **What**: Numeric values that can be aggregated.
- **Examples**: `Total Sales`, `Average Discount`, `Line Item Count`.
- **How to manage**: 
    1. Select **Measure** in the "Type" dropdown.
    2. Choose an **Aggregation**:
        - **Sum**: Totaling values (e.g., total revenue).
        - **Avg**: Finding the mean (e.g., average order value).
        - **Count**: Counting occurrences (e.g., total orders).
        - **Max/Min**: Finding extremes.

### 4. Advanced: Calculated Expressions
You can create new data points without changing your database:
- Locate the **Calculated Expression** field for a measure.
- Enter a SQL-like formula (e.g., `price * tax_rate` or `gross_revenue - refunds`).
- The AI will now be able to answer questions about "Net Profit" even if that column doesn't exist in your raw database.

### 5. Using "AI Magic Enrichment"
If your database has hundreds of columns, use the **AI Magic Enrichment** button at the top right:
1. It analyzes your column names and types.
2. It automatically assigns the most likely Business Names, Types, and Aggregations.
3. **Review & Refine**: Always double-check the AI's suggestions to ensure they match your specific business logic.

---

## 💡 Pro-Tip: The "Vector Refresh"
Whenever you update a Business Name or a Description, Orcha automatically updates the **Semantic Memory**. This ensures that the Chat Agent is always using the most up-to-date context when answering your questions.
