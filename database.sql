-- ============================================================================
-- Style Matrix - Complete Database Setup
-- ============================================================================
-- This file contains everything needed to set up the Style Matrix database
-- Run this in your Supabase SQL Editor after deleting all existing tables
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  is_active BOOLEAN DEFAULT true
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT DEFAULT 'service',
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai')
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card')),
  subtotal DECIMAL(10,2) NOT NULL,
  tips DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  transaction_date TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai'),
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai')
);

-- Transaction items (services in each transaction)
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER DEFAULT 1
);

-- Users table (for authentication)
-- Note: In production, use Supabase Auth instead
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Dubai')
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_employee ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean setup)
DROP POLICY IF EXISTS "Anyone can view active employees" ON employees;
DROP POLICY IF EXISTS "Admins can manage employees" ON employees;
DROP POLICY IF EXISTS "Anyone can view services" ON services;
DROP POLICY IF EXISTS "Admins can manage services" ON services;
DROP POLICY IF EXISTS "Employees can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view transaction items" ON transaction_items;
DROP POLICY IF EXISTS "Authenticated users can create transaction items" ON transaction_items;
DROP POLICY IF EXISTS "Allow user authentication queries" ON users;
DROP POLICY IF EXISTS "Allow user creation" ON users;

-- Policies for employees table
CREATE POLICY "Anyone can view active employees"
ON employees FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage employees"
ON employees FOR ALL
USING (true); -- In production, check user role

-- Policies for services table
CREATE POLICY "Anyone can view services"
ON services FOR SELECT
USING (true);

CREATE POLICY "Admins can manage services"
ON services FOR ALL
USING (true); -- In production, check user role

-- Policies for transactions table
CREATE POLICY "Employees can view own transactions"
ON transactions FOR SELECT
USING (true); -- In production, check employee_id matches user's employee_id

CREATE POLICY "Admins can view all transactions"
ON transactions FOR SELECT
USING (true); -- In production, check user role

CREATE POLICY "Authenticated users can create transactions"
ON transactions FOR INSERT
WITH CHECK (true); -- In production, validate employee_id

-- Policies for transaction_items table
CREATE POLICY "Users can view transaction items"
ON transaction_items FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create transaction items"
ON transaction_items FOR INSERT
WITH CHECK (true);

-- Policies for users table (needed for authentication)
CREATE POLICY "Allow user authentication queries"
ON users FOR SELECT
USING (true);

CREATE POLICY "Allow user creation"
ON users FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- TEST DATA
-- ============================================================================

-- Create a test employee and admin user
DO $$
DECLARE
    employee_uuid UUID;
BEGIN
    -- Insert test employee and get the ID
    INSERT INTO employees (name, phone) 
    VALUES ('Test Employee', '+971501234567')
    RETURNING id INTO employee_uuid;
    
    -- Create employee user with the employee ID
    INSERT INTO users (email, password_hash, role, employee_id) 
    VALUES ('employee@stylematrix.com', 'employee123', 'employee', employee_uuid)
    ON CONFLICT (email) DO NOTHING;
    
    RAISE NOTICE 'Employee created with ID: %', employee_uuid;
END $$;

-- Create an admin user (no employee_id needed)
INSERT INTO users (email, password_hash, role) 
VALUES ('admin@stylematrix.com', 'Admin@123', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Create sample services
INSERT INTO services (name, price, category) VALUES
    ('Haircut', 50.00, 'service'),
    ('Hair Color', 150.00, 'service'),
    ('Hair Styling', 80.00, 'service'),
    ('Beard Trim', 30.00, 'service'),
    ('Shampoo', 20.00, 'service'),
    ('Hair Product', 25.00, 'product')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Display created users
SELECT 
    u.id,
    u.email,
    u.role,
    e.name as employee_name,
    e.phone as employee_phone
FROM users u
LEFT JOIN employees e ON u.employee_id = e.id
ORDER BY u.role, u.email;

-- Display created employees
SELECT id, name, phone, is_active, created_at
FROM employees
ORDER BY created_at;

-- Display created services
SELECT id, name, price, category, created_at
FROM services
ORDER BY category, name;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Login Credentials:
--   Admin:   admin@stylematrix.com / Admin@123
--   Employee: employee@stylematrix.com / employee123
--
-- For production:
--   1. Use Supabase Auth instead of custom users table
--   2. Implement proper password hashing (bcrypt)
--   3. Update RLS policies to check auth.uid() and user roles properly
--   4. Restrict policies based on actual authentication
--
-- ============================================================================

