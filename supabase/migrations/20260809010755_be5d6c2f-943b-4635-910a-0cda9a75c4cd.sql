DROP POLICY IF EXISTS "clientas leen imagenes de catalogo" ON storage.objects;
CREATE POLICY "clientas leen imagenes de catalogo" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cookies-moon' AND (storage.foldername(name))[1] = 'catalogo' AND public.is_client());