-- Crear bucket para documentos de desafíos
insert into storage.buckets (id, name, public)
values ('desafios-docs', 'desafios-docs', true)
on conflict (id) do nothing;

-- Crear bucket para avatars si no existe
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Políticas para desafíos-docs
create policy "Public Access challenges"
on storage.objects for select
using ( bucket_id = 'desafios-docs' );

create policy "Authenticated users can upload challenges"
on storage.objects for insert
with check ( bucket_id = 'desafios-docs' AND auth.role() = 'authenticated' );

create policy "Authenticated users can update challenges"
on storage.objects for update
using ( bucket_id = 'desafios-docs' AND auth.role() = 'authenticated' );

create policy "Authenticated users can delete challenges"
on storage.objects for delete
using ( bucket_id = 'desafios-docs' AND auth.role() = 'authenticated' );


-- Políticas para avatars
create policy "Public Access avatars"
on storage.objects for select
using ( bucket_id = 'avatars' );

create policy "Authenticated users can upload avatars"
on storage.objects for insert
with check ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

create policy "Authenticated users can update avatars"
on storage.objects for update
using ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

create policy "Authenticated users can delete avatars"
on storage.objects for delete
using ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );
