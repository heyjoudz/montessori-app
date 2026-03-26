-- Backfill missing tc_curriculum_activities.category_id values using existing category names.
-- This targets uncategorized TC lessons that already have names but currently sync into
-- tc_grid_statuses without category/area metadata.

with category_lookup as (
  select id, name
  from public.tc_curriculum_categories
),
resolved as (
  select
    a.id,
    a.tc_id,
    a.name,
    case
      when a.name = 'My Family' then 'My Family'
      when a.name = 'My Home' then 'My Home'
      when a.name ilike '%Neighborhood%' or a.name ilike '%Community helper%' then 'Neighborhood & Careers'
      when a.name ilike '%Independence Day Flag%' or a.name ilike '%Lebanese Flag%' or a.name ilike '%Soldier%' then 'My Country'
      when a.name ilike '%bus%' or a.name ilike '%airplane%' or a.name ilike '%train%' or a.name ilike '%car%' then 'Tranportation'
      when a.name ilike '%planet%' or a.name ilike '%earth%' or a.name ilike '%sun%' or a.name ilike '%moon%' or a.name ilike '%mars%' or a.name ilike '%space%' then 'Geography'
      when a.name ilike '%mammal%' or a.name ilike '%reptile%' or a.name ilike '%fish%' or a.name ilike '%frog%' or a.name ilike '%snail%' or a.name ilike '%butterfly%' or a.name ilike '%chick%' or a.name ilike '%bean%' or a.name ilike '%flower%' or a.name ilike '%plant%' then 'Biology'
      when a.name ilike '%Winter%' or a.name ilike '%snowman%' or a.name ilike '%snowflake%' then 'Winter'
      when a.name ilike '%Fall%' or a.name ilike '%autumn%' or a.name ilike '%leaf%' or a.name ilike '%leaves%' then 'Fall'
      when a.name ilike '%five senses%' or a.name ilike '%5 senses%' or a.name ilike '%eye activity%' or a.name ilike '%flashlight%' then '5 Senses'
      when a.name ilike '%emotion%' or a.name ilike '%happy/sad%' or a.name ilike '%face expressions%' then 'Emotions'
      when a.name ilike '%washing hands%' then 'Care of Self'
      when a.name ilike '%letter%' and (
        a.name ilike '%drawing%' or a.name ilike '%collage%' or a.name ilike '%art%' or a.name ilike '%sound%'
      ) then 'Letter formation Art'
      when a.name ilike '%number%' or a.name ilike '%pattern making%' then 'Numbers 1-10'
      when a.name ilike '%draw%' or a.name ilike '%paint%' or a.name ilike '%rubbing%' or a.name ilike '%dot painting%' or a.name ilike '%van gogh%' then 'Drawing'
      when a.name ilike '%color%' then 'Coloring'
      when a.name ilike '%trace%' then 'Tracing lines'
      when a.name ilike '%cut%' or a.name ilike '%tearing%' or a.name ilike '%lacing%' then 'Cutting'
      when a.name ilike '%community art%' then 'Pasting'
      when a.name ilike '%paste%' or a.name ilike '%collage%' or a.name ilike '%craft%' or a.name ilike '%mobile%' or a.name ilike '%windsock%' or a.name ilike '%windwheel%' or a.name ilike '%bracelet%' or a.name ilike '%puppet%' or a.name ilike '%popsicle%' or a.name ilike '%paper roll%' or a.name ilike '%lantern%' or a.name ilike '%design%' or a.name ilike '%theme activities%' or a.name ilike '%art shelf%' then 'Pasting'
      else null
    end as target_category_name
  from public.tc_curriculum_activities a
  where a.category_id is null
),
matched as (
  select r.id, r.tc_id, r.name, c.id as category_id, c.name as category_name
  from resolved r
  join category_lookup c on c.name = r.target_category_name
  where r.target_category_name is not null
),
updated as (
  update public.tc_curriculum_activities a
  set category_id = m.category_id
  from matched m
  where a.id = m.id
  returning a.tc_id, a.name, a.category_id
)
select 'updated_rows' as kind, count(*)::text as value
from updated
union all
select 'remaining_null_category_rows' as kind, count(*)::text as value
from public.tc_curriculum_activities
where category_id is null;

-- Optional inspection query after running the update:
-- select tc_id, name
-- from public.tc_curriculum_activities
-- where category_id is null
-- order by tc_id;
