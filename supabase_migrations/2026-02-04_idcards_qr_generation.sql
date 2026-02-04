CREATE OR REPLACE FUNCTION public.hash_int(input text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT abs(('x' || substr(md5(input), 1, 8))::bit(32)::int);
$$;

ALTER TABLE public.student_ids
  DROP CONSTRAINT IF EXISTS student_ids_student_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS student_ids_one_active_per_student_idx
ON public.student_ids (student_id)
WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.student_ids_set_qr_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  lrn_value text;
  last4 text;
  issue_year text;
  attempt int;
  suffix text;
  candidate text;
BEGIN
  IF new.qr_code IS NOT NULL AND btrim(new.qr_code) <> '' THEN
    RETURN new;
  END IF;

  SELECT s.lrn
  INTO lrn_value
  FROM public.students s
  WHERE s.id = new.student_id;

  last4 := right(regexp_replace(coalesce(lrn_value, ''), '\D', '', 'g'), 4);
  last4 := lpad(coalesce(last4, ''), 4, '0');
  issue_year := extract(year FROM current_date)::int::text;

  FOR attempt IN 0..30 LOOP
    suffix := lpad(((public.hash_int(new.student_id::text || '|' || attempt::text) % 9000) + 1000)::text, 4, '0');
    candidate := 'EDU-' || issue_year || '-' || last4 || '-' || suffix;
    IF NOT EXISTS (SELECT 1 FROM public.student_ids si WHERE si.qr_code = candidate) THEN
      new.qr_code := candidate;
      RETURN new;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Failed to generate unique qr_code for student_id %', new.student_id;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_ids_set_qr_code ON public.student_ids;
CREATE TRIGGER trg_student_ids_set_qr_code
BEFORE INSERT ON public.student_ids
FOR EACH ROW
EXECUTE FUNCTION public.student_ids_set_qr_code();

CREATE OR REPLACE FUNCTION public.student_ids_prevent_qr_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.qr_code IS DISTINCT FROM old.qr_code THEN
    RAISE EXCEPTION 'qr_code is immutable; create a new ID instead';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_ids_prevent_qr_update ON public.student_ids;
CREATE TRIGGER trg_student_ids_prevent_qr_update
BEFORE UPDATE OF qr_code ON public.student_ids
FOR EACH ROW
EXECUTE FUNCTION public.student_ids_prevent_qr_update();

CREATE OR REPLACE FUNCTION public.issue_student_id(p_student_id uuid, p_force boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id uuid;
  new_code text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT si.id
  INTO existing_id
  FROM public.student_ids si
  WHERE si.student_id = p_student_id
    AND si.is_active = true
  ORDER BY si.created_at DESC
  LIMIT 1;

  IF existing_id IS NOT NULL AND NOT p_force THEN
    RAISE EXCEPTION 'active_id_exists';
  END IF;

  IF existing_id IS NOT NULL THEN
    UPDATE public.student_ids
    SET is_active = false
    WHERE id = existing_id;
  END IF;

  INSERT INTO public.student_ids (student_id, is_active)
  VALUES (p_student_id, true)
  RETURNING qr_code INTO new_code;

  RETURN new_code;
END;
$$;
