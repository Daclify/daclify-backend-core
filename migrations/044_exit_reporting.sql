-- At most 256 DAO references produce two bounded components each, plus service outcomes.
-- This stays below the public 1024-component limit; no table/index or personal identifier is added.
ALTER TABLE account_exit_operations DROP CONSTRAINT account_exit_operations_components_check;
ALTER TABLE account_exit_operations ADD CONSTRAINT account_exit_operations_components_check CHECK(octet_length(components::text)<=262144);
