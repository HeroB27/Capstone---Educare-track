-- Simple query to check clinic_visits table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clinic_visits' 
AND table_schema = 'public'
ORDER BY ordinal_position;