-- Incolla tutto in Supabase > SQL Editor e premi Run
create table articles(id bigint generated always as identity primary key, title text not null, category text default 'Allenamenti', excerpt text, body text, image_url text, published boolean default true, created_at timestamptz default now());
create table products(id bigint generated always as identity primary key, name text not null, description text, price_cents int not null default 0, image_url text, file_path text, active boolean default true, created_at timestamptz default now());
create table packages(id bigint generated always as identity primary key, name text not null, price_cents int not null, note text, features text, sort int default 0);
create table orders(id bigint generated always as identity primary key, session_id text unique, email text, items jsonb, total_cents int, created_at timestamptz default now());
alter table articles enable row level security; alter table products enable row level security; alter table packages enable row level security; alter table orders enable row level security;
create policy a_pub on articles for select using (published);
create policy p_pub on products for select using (active);
create policy k_pub on packages for select using (true);
create policy a_adm on articles for all to authenticated using (true) with check (true);
create policy p_adm on products for all to authenticated using (true) with check (true);
create policy k_adm on packages for all to authenticated using (true) with check (true);
create policy o_adm on orders for select to authenticated using (true);
insert into storage.buckets(id,name,public) values ('images','images',true),('downloads','downloads',false) on conflict do nothing;
create policy img_pub on storage.objects for select using (bucket_id='images');
create policy file_adm on storage.objects for all to authenticated using (bucket_id in ('images','downloads')) with check (bucket_id in ('images','downloads'));
insert into packages(name,price_cents,note,features,sort) values
('Trimestrale',12000,'40 € al mese','Piano personalizzato su analisi fisiologiche'||chr(10)||'Allenamenti caricati sul tuo ciclocomputer'||chr(10)||'Monitoraggio di potenza, frequenza cardiaca e soglia',1),
('Semestrale',21000,'35 € al mese','Piano personalizzato su analisi fisiologiche'||chr(10)||'Allenamenti caricati sul tuo ciclocomputer'||chr(10)||'Monitoraggio di potenza, frequenza cardiaca e soglia',2),
('Annuale',39000,'32,50 € al mese','Piano personalizzato su analisi fisiologiche'||chr(10)||'Allenamenti caricati sul tuo ciclocomputer'||chr(10)||'Monitoraggio di potenza, frequenza cardiaca e soglia',3);
