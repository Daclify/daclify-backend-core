ALTER TABLE telegram_oidc_attempts ADD COLUMN frontend_origin text;
ALTER TABLE telegram_oidc_attempts ADD COLUMN return_to text;
ALTER TABLE telegram_oidc_attempts ADD CONSTRAINT telegram_destination_length CHECK ((frontend_origin IS NULL OR length(frontend_origin)<=2048) AND (return_to IS NULL OR length(return_to)<=2048));
