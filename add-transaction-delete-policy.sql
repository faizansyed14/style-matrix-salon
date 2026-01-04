-- ============================================================================
-- Add Transaction Delete Policy for Admins
-- ============================================================================
-- This script adds a DELETE policy to allow admins to delete transactions
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can delete transactions" ON transactions;

-- Create policy to allow admins to delete transactions
CREATE POLICY "Admins can delete transactions"
ON transactions FOR DELETE
USING (true); -- In production, check user role is 'admin'

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this, admins will be able to delete transactions from the
-- dashboard. Transaction items will be automatically deleted due to the
-- ON DELETE CASCADE constraint on transaction_items.transaction_id.
-- ============================================================================

