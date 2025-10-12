/*
  # Add User Registration Policy

  1. Problem
    - Users table has no INSERT policy
    - During signup, we need to create a user record but RLS blocks it
  
  2. Solution
    - Add INSERT policy for authenticated users to create their own user record
    - Allow users to insert a record if the auth_user_id matches their own auth.uid()
  
  3. Changes
    - CREATE POLICY "Users can create own profile" for INSERT
*/

-- Add policy for users to insert their own profile during registration
CREATE POLICY "Users can create own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());
