-- Demo courses matching lib/courses SEED_COURSES, so postgres mode shows the
-- same two default courses as local mode. Idempotent.

insert into builder_courses (id, title, description, badge_label, badge_color, owner, store_id, status, modules, created_at, updated_at)
values
  (
    'diamond-4cs-foundations',
    'Diamond 4Cs Foundations',
    'The essentials of cut, color, clarity, and carat every associate should know before working the case.',
    'Diamond Foundations',
    '#1f9e75',
    'Admin',
    null,
    'Published',
    '[
      {"id":"m1","type":"video","title":"The 4Cs, explained","videoUrl":""},
      {"id":"m2","type":"quiz","title":"Quick check: the 4Cs","passingCount":2,"questions":[
        {"id":"q1","prompt":"Which C describes a diamond''s sparkle and light return?","options":["Carat","Cut","Clarity","Color"],"answerIndex":1},
        {"id":"q2","prompt":"Color is graded on a scale from…","options":["1–10","A–F","D–Z","I–V"],"answerIndex":2},
        {"id":"q3","prompt":"Carat is a measure of a diamond''s…","options":["Weight","Shine","Shape","Cut grade"],"answerIndex":0}
      ]},
      {"id":"m3","type":"upload","title":"Show what you learned","instructions":"Upload a photo of you explaining the 4Cs to a colleague or a short written summary."}
    ]'::jsonb,
    '2026-06-20T15:00:00.000Z',
    '2026-06-20T15:00:00.000Z'
  ),
  (
    'clienteling-basics',
    'Clienteling Basics',
    'Build lasting client relationships that bring shoppers back to your store.',
    'Clienteling',
    '#e2683c',
    'Admin',
    null,
    'Published',
    '[
      {"id":"m1","type":"video","title":"Why clienteling wins","videoUrl":""},
      {"id":"m2","type":"upload","title":"Your follow-up plan","instructions":"Upload your personal client follow-up template."}
    ]'::jsonb,
    '2026-06-24T15:00:00.000Z',
    '2026-06-24T15:00:00.000Z'
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  badge_label = excluded.badge_label,
  badge_color = excluded.badge_color,
  owner = excluded.owner,
  status = excluded.status,
  modules = excluded.modules,
  updated_at = excluded.updated_at;
