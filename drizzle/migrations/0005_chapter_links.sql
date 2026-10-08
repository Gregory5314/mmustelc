CREATE TABLE public.chapter_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL,
  image_url text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chapter_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_links TO authenticated;
GRANT ALL ON public.chapter_links TO service_role;
ALTER TABLE public.chapter_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads links" ON public.chapter_links FOR SELECT USING (true);
CREATE POLICY "Admins insert links" ON public.chapter_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'president'));
CREATE POLICY "Admins update links" ON public.chapter_links FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'president'));
CREATE POLICY "Admins delete links" ON public.chapter_links FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'president'));
INSERT INTO public.chapter_links (label, url, image_url, position)
SELECT v.label, v.url, li.image_url, v.pos FROM (VALUES
 ('equity_taleo','Equity Taleo Careers','https://equitybank.taleo.net/careersection/ext_new/jobsearch.ftl',0),
 ('equity_group_foundation','Equity Group Foundation','https://equitygroupfoundation.com',1),
 ('equity_afya','Equity Afya Careers','https://equityafya.co.ke/careers/',2),
 ('mmust_site','MMUST Official Site','https://www.mmust.ac.ke',3),
 ('activities','Chapter Activities','/activities',4),
 ('members','Members List','/members',5),
 ('officials','Chapter Officials','/officials',6)
) AS v(k,label,url,pos) LEFT JOIN public.link_images li ON li.link_key = v.k;