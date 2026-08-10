-- Restore GemMatch as the user-facing name of the built-in personality
-- assessment. JewelCert remains the name of the invitation bundle that can
-- include this assessment along with tests and courses.
update admin_assessment_defaults
set name = 'GemMatch Personality Assessment',
    updated_at = now()
where id = 'gemmatch'
  and name is distinct from 'GemMatch Personality Assessment';
