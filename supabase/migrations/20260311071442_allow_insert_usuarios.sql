-- 1. Ensure RLS is enabled on the usuarios table (usually it should be, but just in case)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 2. Give the authenticated and anonymous roles the privilege to insert into public schemas
-- (This resolves the "permission denied for schema public" if it was revoked)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 3. Policy to allow a user to insert their own record upon sign up
-- Since the trigger is usually responsible for this, we add a generic insert policy matching their auth.uid
CREATE POLICY "Enable insert for authenticated users only"
ON public.usuarios
FOR INSERT
WITH CHECK (
  auth.uid() = id
);

-- Note: The auth.uid() function checks the UUID from the JWT token of Supabase Auth.
-- We also add a policy for UPDATE since the signup flow does a .upsert()
CREATE POLICY "Enable update for users based on id"
ON public.usuarios
FOR UPDATE
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);
