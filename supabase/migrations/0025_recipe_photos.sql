-- Photos for community recipes. A public bucket (photos are shown on cards, so every signed-in person can load them);
-- people can only add, list and remove files inside their own folder, named after their user id:
--   recipe-photos/<user id>/<random>.jpg
-- submit_recipe only accepts a photo URL that points into the author's own folder. Files are small JPEGs (the app
-- resizes them before uploading), so the bucket caps size and type as a second line of defence.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 3145728, array['image/jpeg'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "recipe_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipe_photos_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipe_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);
