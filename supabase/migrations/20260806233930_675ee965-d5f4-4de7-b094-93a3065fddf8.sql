
CREATE POLICY "cm_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cookies-moon');
CREATE POLICY "cm_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cookies-moon');
CREATE POLICY "cm_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cookies-moon');
CREATE POLICY "cm_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cookies-moon');
