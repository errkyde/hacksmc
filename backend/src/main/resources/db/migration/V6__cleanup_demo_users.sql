-- Remove demo users and all their data.
-- nat_rules has no CASCADE on user_id/host_id, so delete those first.
DELETE FROM nat_rules WHERE user_id IN (SELECT id FROM users WHERE username IN ('phil', 'lisa', 'felix', 'sarah'));
DELETE FROM users WHERE username IN ('phil', 'lisa', 'felix', 'sarah');
