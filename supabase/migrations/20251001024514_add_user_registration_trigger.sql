/*
  # Add automatic user profile creation on registration

  1. Changes
    - Creates a trigger function that automatically creates a user profile in the `users` table when a new auth user is created
    - Sets up the trigger to fire after insert on auth.users
    - Automatically generates a customer_id and sets default role to 'buyer'
  
  2. Security
    - Function executes with security definer to have necessary permissions
    - Only creates user profile, doesn't modify auth.users
*/

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, customer_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    'CUST-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
    'buyer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
