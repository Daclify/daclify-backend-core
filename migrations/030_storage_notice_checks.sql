ALTER TABLE storage_subscriptions ADD COLUMN notice_checked_at timestamptz;
CREATE INDEX storage_notice_checks ON storage_subscriptions(notice_checked_at,id);
