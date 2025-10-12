import { supabase } from '../lib/supabase';

export async function seedAdminUser(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'initialized')
      .maybeSingle();

    if (settings?.value === true) {
      return {
        success: false,
        message: 'Admin user already seeded. Initialization flag is set to true.',
      };
    }

    const adminEmail = 'travis@ts-enterprises.net';
    const adminPassword = 'mypassword123';

    const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
    const userExists = existingAuthUser?.users?.some(u => u.email === adminEmail);

    if (userExists) {
      return {
        success: false,
        message: 'Admin user already exists in auth.users',
      };
    }

    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: adminEmail,
      password: adminPassword,
      options: {
        emailRedirectTo: undefined,
      },
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    if (!authUser?.user) {
      throw new Error('Failed to create auth user: no user returned');
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (signInError) {
      throw new Error(`Failed to sign in after creating user: ${signInError.message}`);
    }

    const { error: userError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUser.user.id,
        email: adminEmail,
        role: 'admin',
        active: true,
        customer_id: null,
      });

    if (userError) {
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    await supabase
      .from('settings')
      .upsert({ key: 'initialized', value: 'true' });

    return {
      success: true,
      message: `Admin user created successfully!\nEmail: ${adminEmail}\nPassword: ${adminPassword}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error seeding admin user: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
