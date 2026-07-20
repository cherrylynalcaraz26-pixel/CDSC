-- Allow items to have multiple pictures. image_url is kept in sync with
-- image_urls[0] so existing consumers (e.g. the client portal catalog)
-- keep working unchanged.
alter table items add column if not exists image_urls text[] not null default '{}';

update items
set image_urls = array[image_url]
where image_url is not null and image_urls = '{}';
