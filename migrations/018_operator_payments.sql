-- Independent operator projection. Merchant credentials and provider ledgers stay with the central service.
CREATE TABLE operator_payment_requests (
  request_id uuid PRIMARY KEY,
  dao_key text NOT NULL,
  product_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id),
  central_order_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operator_payment_customer ON operator_payment_requests(account_id,dao_key);
