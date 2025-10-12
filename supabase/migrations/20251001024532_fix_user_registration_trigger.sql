/*
  # Fix user registration trigger to handle customer relationship

  1. Changes
    - Updates trigger function to allow NULL customer_id (for users without a company account yet)
    - Creates user profile with buyer role by default
    - Customer account can be created/linked later through admin panel
  
  2. Security
    - Function executes with security definer to have necessary permissions
*/

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Updated function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, customer_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULL,
    'buyer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
