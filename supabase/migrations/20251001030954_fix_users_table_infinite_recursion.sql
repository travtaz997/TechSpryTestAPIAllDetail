/*
  # Fix Infinite Recursion in Users Table RLS Policies

  1. Problem
    - The existing admin policies query the users table to check if someone is an admin
    - This creates infinite recursion: checking if you can read users requires reading users
  
  2. Solution
    - Drop the problematic recursive policies
    - Create simpler policies that don't reference the users table
    - Users can always view their own profile (no recursion)
    - Admins will need to be managed through application logic or direct SQL
  
  3. Changes
    - DROP policy "Admins can manage users"
    - DROP policy "Admins can view all users"
    - Keep "Users can view own profile" (no recursion)
    - Add "Users can update own profile" (no recursion)
*/

-- Drop the recursive policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can manage users" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- Keep the simple non-recursive policy for users to view their own profile
-- This policy already exists and is fine: "Users can view own profile"

-- Add policy for users to update their own profile (non-recursive)
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
