#include "authority.hpp"
#include "token_payout.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
using namespace eosio;
// Telos account names sold through Daclify. Prices, sellers, and fee splits stay on this contract.
CONTRACT names : public contract {
public:
  using contract::contract;
  TABLE namescfg {
    name runtime;
    name settler;
    name treasury;
    uint16_t third_party_bps;
    uint16_t first_party_bps;
    name token_contract;
    symbol token_symbol;
    EOSLIB_SERIALIZE(namescfg,(runtime)(settler)(treasury)(third_party_bps)(first_party_bps)(token_contract)(token_symbol))
  };
  using settings = singleton<"namescfg"_n, namescfg>;
  TABLE tier_row {
    uint8_t kind;
    asset price;
    uint32_t usd_cents;
    uint32_t ram_bytes;
    asset net_stake;
    asset cpu_stake;
    uint64_t primary_key() const { return kind; }
    EOSLIB_SERIALIZE(tier_row,(kind)(price)(usd_cents)(ram_bytes)(net_stake)(cpu_stake))
  };
  using tiers = multi_index<"tiers"_n, tier_row>;
  TABLE listing_row {
    name account_name;
    name seller;
    asset price;
    uint32_t usd_cents;
    uint8_t accepts;
    uint8_t sold;
    uint64_t primary_key() const { return account_name.value; }
    EOSLIB_SERIALIZE(listing_row,(account_name)(seller)(price)(usd_cents)(accepts)(sold))
  };
  using listings = multi_index<"namelist"_n, listing_row>;
  TABLE sale_row {
    uint64_t id;
    name account_name;
    name payer;
    name seller;
    public_key owner_key;
    asset gross;
    asset platform_fee;
    uint32_t usd_cents;
    uint32_t platform_cents;
    uint16_t bps;
    uint8_t rail;
    checksum256 reference;
    uint64_t primary_key() const { return id; }
    uint64_t by_name() const { return account_name.value; }
    checksum256 by_reference() const { return reference; }
    EOSLIB_SERIALIZE(sale_row,(id)(account_name)(payer)(seller)(owner_key)(gross)(platform_fee)(usd_cents)(platform_cents)(bps)(rail)(reference))
  };
  using sales = multi_index<"sales"_n, sale_row,
    indexed_by<"byname"_n, const_mem_fun<sale_row, uint64_t, &sale_row::by_name>>,
    indexed_by<"byref"_n, const_mem_fun<sale_row, checksum256, &sale_row::by_reference>>>;
  TABLE intent_row {
    name buyer;
    name account_name;
    public_key owner_key;
    public_key active_key;
    uint32_t expires;
    uint64_t primary_key() const { return buyer.value; }
    EOSLIB_SERIALIZE(intent_row,(buyer)(account_name)(owner_key)(active_key)(expires))
  };
  using intents = multi_index<"intents"_n, intent_row>;
  // A new table so an existing namescfg row stays readable.
  TABLE policy_row {
    uint16_t bump_bps;
    uint16_t quote_premium_bps;
    uint64_t median;
    uint8_t quoted_precision;
    uint32_t observed_at;
    EOSLIB_SERIALIZE(policy_row,(bump_bps)(quote_premium_bps)(median)(quoted_precision)(observed_at))
  };
  using policies = singleton<"policy"_n, policy_row>;
  TABLE profit_row {
    uint8_t version;
    uint32_t minimum_usd_cents;
    uint16_t card_fee_bps;
    uint32_t card_fixed_usd_cents;
    uint32_t fee_observed_at;
    EOSLIB_SERIALIZE(profit_row,(version)(minimum_usd_cents)(card_fee_bps)(card_fixed_usd_cents)(fee_observed_at))
  };
  using profits = singleton<"profitcfg"_n, profit_row>;
  TABLE profit_check {
    uint64_t sale_id;
    int64_t before_balance;
    int64_t gross_units;
    uint32_t net_usd_cents;
    uint32_t minimum_usd_cents;
    uint64_t median;
    uint8_t quoted_precision;
    uint8_t rail;
    EOSLIB_SERIALIZE(profit_check,(sale_id)(before_balance)(gross_units)(net_usd_cents)(minimum_usd_cents)(median)(quoted_precision)(rail))
  };
  using profit_checks = singleton<"profitcheck"_n, profit_check>;
  struct connector {
    asset balance;
    double weight;
    EOSLIB_SERIALIZE(connector,(balance)(weight))
  };
  struct ram_market {
    asset supply;
    connector base;
    connector quote;
    uint64_t primary_key() const { return supply.symbol.raw(); }
    EOSLIB_SERIALIZE(ram_market,(supply)(base)(quote))
  };
  // The owner of an existing account connects it and sells names that end with it.
  TABLE suffix_row {
    name suffix;
    name seller;
    asset price;
    uint32_t usd_cents;
    uint8_t accepts;
    uint32_t sales_count;
    uint64_t primary_key() const { return suffix.value; }
    EOSLIB_SERIALIZE(suffix_row,(suffix)(seller)(price)(usd_cents)(accepts)(sales_count))
  };
  using suffixes = multi_index<"suffixes"_n, suffix_row>;

  ACTION init(name runtime, name settler, name token_contract, symbol token_symbol) {
    require_auth(get_self());
    settings saved(get_self(), get_self().value);
    check(!saved.exists(), "ALREADY_INITIALIZED");
    check(is_account(runtime) && is_account(settler) && is_account(token_contract), "FEE_ACCOUNT");
    check(token_symbol.is_valid(), "FEE_SYMBOL");
    saved.set(namescfg{runtime, settler, name(), 500, 10000, token_contract, token_symbol}, get_self());
  }
  ACTION setrates(name runtime, uint16_t third_party_bps, uint16_t first_party_bps, name treasury, name token_contract, symbol token_symbol) {
    auto cfg = load();
    check(runtime == cfg.runtime, "RUNTIME");
    require_auth(runtime);
    check(third_party_bps <= 10000 && first_party_bps <= 10000, "FEE_BPS");
    check(is_account(treasury) && treasury != get_self(), "FEE_ACCOUNT");
    check(token_contract == cfg.token_contract && token_symbol == cfg.token_symbol, "TOKEN_IDENTITY");
    cfg.third_party_bps = third_party_bps;
    cfg.first_party_bps = first_party_bps;
    cfg.treasury = treasury;
    settings(get_self(), get_self().value).set(cfg, get_self());
  }
  ACTION setsettler(name settler) {
    require_auth(get_self());
    check(is_account(settler), "FEE_ACCOUNT");
    auto cfg = load();
    cfg.settler = settler;
    settings(get_self(), get_self().value).set(cfg, get_self());
  }
  ACTION settier(uint8_t kind, asset price, uint32_t usd_cents, uint32_t ram_bytes, asset net_stake, asset cpu_stake) {
    require_auth(get_self());
    const auto cfg = load();
    check(kind <= 1, "TIER");
    check_price(price, cfg.token_symbol);
    check(usd_cents <= 100000000, "PRICE_LIMIT");
    check(price.amount > 0 || usd_cents > 0, "PRICE");
    check(ram_bytes >= 3000 && ram_bytes <= 1048576, "RAM");
    check(net_stake.is_valid() && cpu_stake.is_valid(), "STAKE");
    check(net_stake.symbol == cfg.token_symbol && cpu_stake.symbol == cfg.token_symbol, "STAKE");
    check(net_stake.amount >= 0 && cpu_stake.amount >= 0, "STAKE");
    tiers rows(get_self(), get_self().value);
    auto it = rows.find(kind);
    auto write = [&](auto& row) {
      row.kind = kind;
      row.price = price;
      row.usd_cents = usd_cents;
      row.ram_bytes = ram_bytes;
      row.net_stake = net_stake;
      row.cpu_stake = cpu_stake;
    };
    if (it == rows.end()) rows.emplace(get_self(), write);
    else rows.modify(it, same_payer, write);
  }
  // A seller lists one special name. The action is refused unless the fee rule is accepted.
  ACTION regname(name seller, name account_name, asset price, uint32_t usd_cents, uint8_t accepts_fee_rule) {
    require_auth(seller);
    check(accepts_fee_rule == 1, "FEE_RULE");
    check(seller != get_self(), "FEE_ACCOUNT");
    const auto cfg = load();
    check(cfg.treasury.value && seller != cfg.treasury, "FEE_PARTY");
    check_name(account_name);
    check(account_name.suffix() == account_name || account_name.suffix() == seller, "NATIVE_SUFFIX_REQUIRED");
    check(!is_account(account_name), "NAME_TAKEN");
    check_price(price, cfg.token_symbol);
    check(usd_cents <= 100000000, "PRICE_LIMIT");
    check(price.amount > 0 || usd_cents > 0, "PRICE");
    if (account_name.suffix() != account_name) check_floor(price, usd_cents);
    listings rows(get_self(), get_self().value);
    check(rows.find(account_name.value) == rows.end(), "NAME_LISTED");
    sales sold(get_self(), get_self().value);
    auto names_index = sold.get_index<"byname"_n>();
    check(names_index.find(account_name.value) == names_index.end(), "NAME_SOLD");
    rows.emplace(get_self(), [&](auto& row) {
      row.account_name = account_name;
      row.seller = seller;
      row.price = price;
      row.usd_cents = usd_cents;
      row.accepts = 1;
      row.sold = 0;
    });
  }
  // The suffix account must already exist. Each later sale raises its price.
  ACTION regsuffix(name suffix, asset price, uint32_t usd_cents, uint8_t accepts_fee_rule) {
    require_auth(suffix);
    check(accepts_fee_rule == 1, "FEE_RULE");
    const auto cfg = load();
    check(is_account(suffix) && suffix != get_self() && suffix != cfg.treasury, "FEE_PARTY");
    check_name(suffix);
    check(suffix.suffix() == suffix, "NATIVE_SUFFIX_REQUIRED");
    check_price(price, cfg.token_symbol);
    check(usd_cents <= 100000000, "PRICE_LIMIT");
    check(price.amount > 0 || usd_cents > 0, "PRICE");
    check_floor(price, usd_cents);
    suffixes rows(get_self(), get_self().value);
    auto it = rows.find(suffix.value);
    auto write = [&](auto& row) {
      row.suffix = suffix;
      row.seller = suffix;
      row.price = price;
      row.usd_cents = usd_cents;
      row.accepts = 1;
    };
    if (it == rows.end()) rows.emplace(get_self(), [&](auto& row) { write(row); row.sales_count = 0; });
    else rows.modify(it, same_payer, write);
  }
  ACTION editname(name seller, name account_name, asset price, uint32_t usd_cents, uint8_t accepts_fee_rule) {
    require_auth(seller);
    const auto cfg = load();
    check(accepts_fee_rule == 1, "FEE_RULE");
    check_price(price, cfg.token_symbol);
    check(usd_cents <= 100000000 && (price.amount > 0 || usd_cents > 0), "PRICE");
    listings rows(get_self(), get_self().value);
    const auto& item = rows.get(account_name.value, "NAME_LISTED");
    check(item.seller == seller, "SELLER");
    check(item.sold == 0 && !is_account(account_name), "NAME_SOLD");
    if (account_name.suffix() != account_name) check_floor(price, usd_cents);
    rows.modify(item, same_payer, [&](auto& row) { row.price = price; row.usd_cents = usd_cents; row.accepts = 1; });
  }
  ACTION delname(name seller, name account_name) {
    require_auth(seller);
    listings rows(get_self(), get_self().value);
    const auto& item = rows.get(account_name.value, "NAME_LISTED");
    check(item.seller == seller, "SELLER");
    check(item.sold == 0 && !is_account(account_name), "NAME_SOLD");
    rows.erase(item);
  }
  ACTION delsuffix(name suffix) {
    require_auth(suffix);
    suffixes rows(get_self(), get_self().value);
    const auto& item = rows.get(suffix.value, "SUFFIX");
    rows.erase(item);
  }
  ACTION setpolicy(name runtime, uint16_t bump_bps, uint16_t quote_premium_bps) {
    const auto cfg = load();
    check(runtime == cfg.runtime, "RUNTIME");
    require_auth(runtime);
    check(bump_bps <= 10000 && quote_premium_bps <= 10000, "FEE_BPS");
    policies saved(get_self(), get_self().value);
    auto row = saved.exists() ? saved.get() : policy_row{2000, 2000, 0, 4, 0};
    row.bump_bps = bump_bps;
    row.quote_premium_bps = quote_premium_bps;
    saved.set(row, get_self());
  }
  ACTION setoracle(name runtime, uint64_t median, uint8_t quoted_precision, uint32_t observed_at) {
    const auto cfg = load();
    check(runtime == cfg.runtime, "RUNTIME");
    require_auth(runtime);
    check(median > 0 && median <= 1000000000000, "ORACLE");
    check(quoted_precision <= 18, "PRICE_SCALE");
    check(observed_at > 0, "ORACLE_TIMESTAMP");
    policies saved(get_self(), get_self().value);
    auto row = saved.exists() ? saved.get() : policy_row{2000, 2000, 0, 4, 0};
    row.median = median;
    row.quoted_precision = quoted_precision;
    row.observed_at = observed_at;
    saved.set(row, get_self());
  }
  ACTION setprofit(name runtime, uint8_t version, uint32_t minimum_usd_cents, uint16_t card_fee_bps, uint32_t card_fixed_usd_cents, uint32_t fee_observed_at) {
    const auto cfg = load();
    check(runtime == cfg.runtime, "RUNTIME");
    require_auth(runtime);
    check(version == 1 && minimum_usd_cents >= 100 && minimum_usd_cents <= 100000000 && card_fee_bps < 10000 && card_fixed_usd_cents <= 1000000, "NAME_PROFIT_POLICY");
    check(cfg.token_contract == "eosio.token"_n && cfg.token_symbol == symbol("TLOS", 4), "TOKEN_IDENTITY");
    check(fee_observed_at > 0 && fee_observed_at <= current_time_point().sec_since_epoch(), "NAME_FEE_REFERENCE");
    profits(get_self(), get_self().value).set(profit_row{version, minimum_usd_cents, card_fee_bps, card_fixed_usd_cents, fee_observed_at}, get_self());
  }
  ACTION fulfillnet(name settler, name account_name, public_key owner_key, public_key active_key, uint32_t usd_cents, uint32_t net_usd_cents, checksum256 reference) {
    const auto cfg = load();
    check(settler == cfg.settler, "FEE_ACCOUNT");
    require_auth(settler);
    check(reference != checksum256(), "REFERENCE");
    check(usd_cents > 0 && usd_cents <= 100000000 && net_usd_cents > 0 && net_usd_cents <= usd_cents, "NAME_NET_REQUIRED");
    const auto chosen = offer_for(account_name);
    check(chosen.profit, "NAME_PROFIT_POLICY");
    finish(settler, account_name, chosen, owner_key, active_key, asset(0, cfg.token_symbol), usd_cents, 1, reference, net_usd_cents);
  }
  ACTION checkprofit(uint64_t sale_id) {
    require_auth(get_self());
    profit_checks pending(get_self(), get_self().value);
    check(pending.exists(), "NAME_PROFIT_PENDING");
    const auto guard = pending.get();
    check(guard.sale_id == sale_id, "NAME_PROFIT_PENDING");
    const auto cfg = load();
    const __int128 spent = (__int128)guard.before_balance - liquid_balance(cfg) - guard.gross_units;
    check(spent >= 0 && spent <= 1000000000000, "NAME_PROFIT_LOW");
    const __int128 scale = pow10(guard.quoted_precision + cfg.token_symbol.precision());
    __int128 margin;
    if (guard.rail == 0) {
      check(guard.gross_units >= spent, "NAME_PROFIT_LOW");
      margin = ((__int128)guard.gross_units - spent) * guard.median * 100 / scale;
    } else {
      const __int128 cost = spent * guard.median * 100;
      margin = (__int128)guard.net_usd_cents - (cost + scale - 1) / scale;
    }
    check(margin >= guard.minimum_usd_cents, "NAME_PROFIT_LOW");
    pending.remove();
  }
  ACTION intend(name buyer, name account_name, public_key owner_key, public_key active_key) {
    require_auth(buyer);
    check_name(account_name);
    check(!is_account(account_name), "NAME_TAKEN");
    const auto now = current_time_point().sec_since_epoch();
    intents rows(get_self(), get_self().value);
    auto it = rows.find(buyer.value);
    auto write = [&](auto& row) {
      row.buyer = buyer;
      row.account_name = account_name;
      row.owner_key = owner_key;
      row.active_key = active_key;
      row.expires = now + 3600;
    };
    if (it == rows.end()) rows.emplace(get_self(), write);
    else rows.modify(it, same_payer, write);
  }
  ACTION fulfill(name settler, name account_name, public_key owner_key, public_key active_key, uint32_t usd_cents, checksum256 reference) {
    const auto cfg = load();
    check(settler == cfg.settler, "FEE_ACCOUNT");
    require_auth(settler);
    check(reference != checksum256(), "REFERENCE");
    check(usd_cents > 0 && usd_cents <= 100000000, "PRICE");
    const auto offer = offer_for(account_name);
    check(!offer.profit, "NAME_NET_REQUIRED");
    check(usd_cents == offer.usd_cents, "PRICE");
    const auto zero = asset(0, cfg.token_symbol);
    finish(settler, account_name, offer, owner_key, active_key, zero, usd_cents, 1, reference);
  }
  [[eosio::on_notify("*::transfer")]] void ontransfer(name from, name to, asset quantity, std::string memo) {
    if (to != get_self() || from == get_self()) return;
    check(!profit_checks(get_self(), get_self().value).exists(), "NAME_PROFIT_PENDING");
    check(quantity.is_valid() && quantity.amount > 0, "ASSET_QUANTITY");
    // A float deposit stays on the contract and pays RAM for later account creation.
    if (memo == "float") return;
    check(memo.rfind("buy:", 0) == 0 && memo.size() > 4 && memo.size() <= 16, "NAME_MEMO");
    const name account_name(memo.substr(4));
    check(memo == std::string("buy:") + account_name.to_string(), "NAME_MEMO");
    const auto cfg = load();
    check(get_first_receiver() == cfg.token_contract && quantity.symbol == cfg.token_symbol, "TOKEN_IDENTITY");
    intents pending(get_self(), get_self().value);
    const auto& intent = pending.get(from.value, "NAME_INTENT");
    check(intent.account_name == account_name, "NAME_INTENT");
    check(intent.expires > current_time_point().sec_since_epoch(), "NAME_EXPIRED");
    const auto offer = offer_for(account_name);
    check(offer.price.amount > 0 && quantity == offer.price, "PRICE");
    auto packed = pack(std::make_tuple(account_name, from, current_time_point().sec_since_epoch()));
    finish(from, account_name, offer, intent.owner_key, intent.active_key, quantity, offer.usd_cents, 0, sha256(packed.data(), packed.size()));
    pending.erase(intent);
  }
private:
  struct offer {
    name seller;
    uint8_t party;
    asset price;
    uint32_t usd_cents;
    uint32_t ram_bytes;
    asset net_stake;
    asset cpu_stake;
    bool listed;
    name suffix;
    bool profit = false;
  };
  namescfg load() const {
    settings saved(get_self(), get_self().value);
    check(saved.exists(), "NOT_INITIALIZED");
    return saved.get();
  }
  void check_name(name value) const {
    check(value.value, "NAME");
    const auto written = value.to_string();
    check(written.size() <= 12 && written.front() != '.' && written.back() != '.' && written.find("..") == std::string::npos, "NAME");
  }
  bool is_basic(name value) const {
    const auto written = value.to_string();
    return written.size() == 12 && written.find('.') == std::string::npos;
  }
  void check_price(asset price, symbol token_symbol) const {
    check(price.is_valid() && price.symbol == token_symbol && price.amount >= 0, "PRICE");
    check(price.amount <= 1000000000000, "PRICE_LIMIT");
  }
  offer offer_for(name account_name) const {
    check_name(account_name);
    check(!is_account(account_name), "NAME_TAKEN");
    const auto cfg = load();
    check(cfg.treasury.value, "FEE_UNSET");
    sales sold(get_self(), get_self().value);
    auto names_index = sold.get_index<"byname"_n>();
    check(names_index.find(account_name.value) == names_index.end(), "NAME_SOLD");
    tiers tier_rows(get_self(), get_self().value);
    const auto& tier = tier_rows.get(is_basic(account_name) ? 0 : 1, "TIER_UNSET");
    listings listed(get_self(), get_self().value);
    auto listing = listed.find(account_name.value);
    if (listing != listed.end()) {
      check(listing->sold == 0 && listing->accepts == 1, "FEE_RULE");
      auto chosen = offer{listing->seller, 1, listing->price, listing->usd_cents, tier.ram_bytes, tier.net_stake, tier.cpu_stake, true, name()};
      return account_name.suffix() != account_name ? with_floor(chosen) : chosen;
    }
    const name suffix = suffix_for(account_name);
    if (suffix.value) {
      check(suffix == account_name.suffix(), "NATIVE_SUFFIX_REQUIRED");
      suffixes linked(get_self(), get_self().value);
      const auto& item = linked.get(suffix.value, "SUFFIX");
      auto chosen = with_floor(offer{item.seller, 1, item.price, item.usd_cents, tier.ram_bytes, tier.net_stake, tier.cpu_stake, false, suffix});
      if (chosen.price.amount == 0 && chosen.usd_cents > 0 && current_policy().median > 0) chosen.price = tlos_for_usd(chosen.usd_cents, cfg.token_symbol);
      return chosen;
    }
    check(account_name.to_string().find('.') == std::string::npos, "SUFFIX");
    return tier_offer(tier, is_basic(account_name));
  }
  offer tier_offer(const tier_row& tier, bool basic) const {
    const auto cfg = load();
    asset price = tier.price;
    if (basic && profits(get_self(), get_self().value).exists()) {
      const auto profit = profits(get_self(), get_self().value).get();
      const auto policy = fresh_policy(cfg.token_symbol);
      const int64_t resources = resource_cost(tier, cfg);
      const __int128 scale = pow10(policy.quoted_precision + cfg.token_symbol.precision());
      const __int128 cost = (__int128)resources * policy.median * 100;
      const __int128 minimum = (cost + scale - 1) / scale + profit.minimum_usd_cents;
      check(minimum > 0 && minimum <= 100000000, "PRICE_LIMIT");
      const __int128 numerator = (minimum + profit.card_fixed_usd_cents) * 10000;
      const __int128 card = (numerator + 9999 - profit.card_fee_bps) / (10000 - profit.card_fee_bps);
      check(card <= 100000000, "PRICE_LIMIT");
      const auto now = current_time_point().sec_since_epoch();
      const bool fee_fresh = profit.fee_observed_at <= now && now - profit.fee_observed_at <= 7 * 86400;
      return offer{cfg.treasury, 0, tlos_for_usd((uint32_t)minimum, cfg.token_symbol), fee_fresh ? (uint32_t)card : 0, tier.ram_bytes, tier.net_stake, tier.cpu_stake, false, name(), true};
    }
    if (basic && tier.usd_cents > 0 && current_policy().median > 0) price = tlos_for_usd(tier.usd_cents, cfg.token_symbol);
    return offer{cfg.treasury, 0, price, tier.usd_cents, tier.ram_bytes, tier.net_stake, tier.cpu_stake, false, name()};
  }
  offer basic_offer() const {
    tiers rows(get_self(), get_self().value);
    return tier_offer(rows.get(0, "TIER_UNSET"), true);
  }
  void check_floor(asset price, uint32_t usd_cents) const {
    const auto minimum = basic_offer();
    if (price.amount > 0) {
      check(minimum.price.amount > 0, "TIER_UNSET");
      check(price.amount >= minimum.price.amount, "NAME_PRICE_FLOOR");
    }
    if (usd_cents > 0) {
      check(minimum.usd_cents > 0, "NAME_FEE_REFERENCE");
      check(usd_cents >= minimum.usd_cents, "NAME_PRICE_FLOOR");
    }
  }
  offer with_floor(offer chosen) const {
    const auto minimum = basic_offer();
    if (chosen.price.amount > 0) {
      check(minimum.price.amount > 0, "TIER_UNSET");
      if (chosen.price.amount < minimum.price.amount) chosen.price = minimum.price;
    }
    if (chosen.usd_cents > 0) chosen.usd_cents = minimum.usd_cents == 0 ? 0 : std::max(chosen.usd_cents, minimum.usd_cents);
    return chosen;
  }
  int64_t liquid_balance(const namescfg& cfg) const {
    multi_index<"accounts"_n, daclify::payout_token_balance> rows(cfg.token_contract, get_self().value);
    const auto& balance = rows.get(cfg.token_symbol.code().raw(), "NAME_RESOURCE_FLOAT");
    check(balance.balance.symbol == cfg.token_symbol && balance.balance.amount >= 0, "TOKEN_IDENTITY");
    return balance.balance.amount;
  }
  policy_row fresh_policy(symbol token_symbol) const {
    const auto policy = current_policy();
    const auto now = current_time_point().sec_since_epoch();
    check(policy.median > 0 && policy.observed_at <= now && now - policy.observed_at <= 900, "ORACLE_STALE");
    check(policy.quoted_precision + token_symbol.precision() <= 24, "PRICE_SCALE");
    return policy;
  }
  int64_t resource_cost(const tier_row& tier, const namescfg& cfg) const {
    multi_index<"rammarket"_n, ram_market> market("eosio"_n, "eosio"_n.value);
    const auto& ram = market.get(symbol("RAMCORE", 4).raw(), "NAME_RAM_MARKET");
    check(ram.base.balance.symbol == symbol("RAM", 0) && ram.quote.balance.symbol == cfg.token_symbol && ram.base.weight == 0.5 && ram.quote.weight == 0.5, "NAME_RAM_MARKET");
    check(ram.base.balance.amount > tier.ram_bytes && ram.quote.balance.amount > 0 && ram.quote.balance.amount <= 1000000000000000000, "NAME_RAM_MARKET");
    const __int128 denominator = ram.base.balance.amount - tier.ram_bytes;
    const __int128 numerator = (__int128)ram.quote.balance.amount * tier.ram_bytes;
    const __int128 net = (numerator + denominator - 1) / denominator;
    const __int128 resources = (net * 200 + 198) / 199 + 2 + tier.net_stake.amount + tier.cpu_stake.amount;
    check(resources > 0 && resources <= 1000000000000, "PRICE_LIMIT");
    return (int64_t)resources;
  }
  policy_row current_policy() const {
    policies saved(get_self(), get_self().value);
    if (!saved.exists()) return policy_row{2000, 2000, 0, 4, 0};
    return saved.get();
  }
  // Longest ".suffix" wins, matching the EOS name-service idea of a connected suffix.
  name suffix_for(name account_name) const {
    const auto written = account_name.to_string();
    suffixes rows(get_self(), get_self().value);
    name best;
    size_t best_size = 0;
    for (size_t i = 0; i < written.size(); i++) {
      if (written[i] != '.') continue;
      const auto tail = written.substr(i + 1);
      if (tail.empty() || tail.size() > 12) continue;
      const name candidate(tail);
      if (candidate.to_string() != tail) continue;
      const auto it = rows.find(candidate.value);
      if (it == rows.end() || it->accepts != 1) continue;
      if (tail.size() > best_size) { best = candidate; best_size = tail.size(); }
    }
    return best;
  }
  __int128 pow10(uint8_t precision) const {
    __int128 value = 1;
    for (uint8_t i = 0; i < precision; i++) value *= 10;
    return value;
  }
  asset tlos_for_usd(uint32_t usd_cents, symbol token_symbol) const {
    const auto policy = current_policy();
    check(usd_cents > 0 && policy.median > 0, "ORACLE_EMPTY");
    check(policy.quoted_precision <= 18 && token_symbol.precision() <= 18, "PRICE_SCALE");
    check(policy.quoted_precision + token_symbol.precision() <= 24, "PRICE_SCALE");
    const __int128 numerator = (__int128)usd_cents * pow10(policy.quoted_precision) * (10000 + policy.quote_premium_bps) * pow10(token_symbol.precision());
    const __int128 denominator = 100 * (__int128)policy.median * 10000;
    const __int128 amount = (numerator + denominator - 1) / denominator;
    check(amount > 0 && amount <= 1000000000000, "PRICE_LIMIT");
    return asset((int64_t)amount, token_symbol);
  }
  int64_t raise_units(int64_t amount, uint16_t bump_bps, int64_t limit) const {
    if (amount <= 0 || bump_bps == 0) return amount;
    const __int128 raised = ((__int128)amount * (10000 + bump_bps) + 9999) / 10000;
    check(raised > 0 && raised <= limit, "PRICE_LIMIT");
    return (int64_t)raised;
  }
  void pay(name to, asset quantity, const std::string& memo) {
    if (quantity.amount == 0) return;
    const auto cfg = load();
    check(to != get_self() && is_account(to), "FEE_ACCOUNT");
    action(permission_level{get_self(), "active"_n}, cfg.token_contract, "transfer"_n, std::make_tuple(get_self(), to, quantity, memo)).send();
  }
  void open_account(name account_name, public_key owner_key, public_key active_key, const offer& chosen) {
    check(!is_account(account_name), "NAME_TAKEN");
    daclify::authority owner{1, {{owner_key, 1}}, {}, {}};
    daclify::authority active{1, {{active_key, 1}}, {}, {}};
    const name creator = chosen.suffix.value ? account_name.suffix() : (chosen.listed && !is_basic(account_name) ? chosen.seller : get_self());
    const name permission = creator == get_self() ? "active"_n : "namesale"_n;
    action(permission_level{creator, permission}, "eosio"_n, "newaccount"_n, std::make_tuple(creator, account_name, owner, active)).send();
    action(permission_level{get_self(), "active"_n}, "eosio"_n, "buyrambytes"_n, std::make_tuple(get_self(), account_name, chosen.ram_bytes)).send();
    if (chosen.net_stake.amount > 0 || chosen.cpu_stake.amount > 0) {
      action(permission_level{get_self(), "active"_n}, "eosio"_n, "delegatebw"_n, std::make_tuple(get_self(), account_name, chosen.net_stake, chosen.cpu_stake, true)).send();
    }
  }
  void finish(name payer, name account_name, const offer& chosen, public_key owner_key, public_key active_key, asset gross, uint32_t usd_cents, uint8_t rail, checksum256 reference, uint32_t net_usd_cents = 0) {
    const auto cfg = load();
    const uint16_t bps = chosen.party == 0 ? cfg.first_party_bps : cfg.third_party_bps;
    const __int128 fee = (__int128)gross.amount * bps / 10000;
    check(fee >= 0 && fee <= gross.amount, "FEE_SPLIT");
    const asset platform_fee((int64_t)fee, gross.symbol);
    const asset seller_share(gross.amount - (int64_t)fee, gross.symbol);
    const uint32_t platform_cents = (uint32_t)(((uint64_t)usd_cents * bps) / 10000);
    sales sold(get_self(), get_self().value);
    auto refs = sold.get_index<"byref"_n>();
    check(refs.find(reference) == refs.end(), "REFERENCE_USED");
    auto id = sold.available_primary_key();
    if (!id) id = 1;
    check(id < std::numeric_limits<uint64_t>::max(), "SALE_LIMIT");
    sold.emplace(get_self(), [&](auto& row) {
      row.id = id;
      row.account_name = account_name;
      row.payer = payer;
      row.seller = chosen.seller;
      row.owner_key = owner_key;
      row.gross = gross;
      row.platform_fee = platform_fee;
      row.usd_cents = usd_cents;
      row.platform_cents = platform_cents;
      row.bps = bps;
      row.rail = rail;
      row.reference = reference;
    });
    if (chosen.listed) {
      listings listed(get_self(), get_self().value);
      const auto& listing = listed.get(account_name.value, "NAME_LISTED");
      listed.modify(listing, same_payer, [](auto& row) { row.sold = 1; });
    }
    if (chosen.suffix.value) {
      suffixes linked(get_self(), get_self().value);
      const auto& item = linked.get(chosen.suffix.value, "SUFFIX");
      const auto policy = current_policy();
      const int64_t next_price = raise_units(item.price.amount > 0 ? chosen.price.amount : 0, policy.bump_bps, 1000000000000);
      const int64_t next_usd = raise_units(item.usd_cents > 0 ? std::max(item.usd_cents, chosen.usd_cents) : 0, policy.bump_bps, 100000000);
      check(item.sales_count < std::numeric_limits<uint32_t>::max(), "SALE_LIMIT");
      linked.modify(item, same_payer, [&](auto& row) {
        row.price = asset(next_price, item.price.symbol);
        row.usd_cents = (uint32_t)next_usd;
        row.sales_count = item.sales_count + 1;
      });
    }
    if (chosen.profit) {
      profit_checks pending(get_self(), get_self().value);
      check(!pending.exists(), "NAME_PROFIT_PENDING");
      const auto profit = profits(get_self(), get_self().value).get();
      const auto policy = fresh_policy(cfg.token_symbol);
      pending.set(profit_check{id, liquid_balance(cfg), gross.amount, net_usd_cents, profit.minimum_usd_cents, policy.median, policy.quoted_precision, rail}, get_self());
    }
    pay(cfg.treasury, platform_fee, "Daclify name fee");
    pay(chosen.seller, seller_share, "Daclify name sale");
    open_account(account_name, owner_key, active_key, chosen);
    if (chosen.profit) action(permission_level{get_self(), "active"_n}, get_self(), "checkprofit"_n, std::make_tuple(id)).send();
  }
};
extern "C" void apply(uint64_t receiver, uint64_t code, uint64_t action) {
  if (code == receiver) {
    switch (action) {
      EOSIO_DISPATCH_HELPER(names, (init)(setrates)(setsettler)(settier)(regname)(regsuffix)(editname)(delname)(delsuffix)(setpolicy)(setoracle)(setprofit)(intend)(fulfill)(fulfillnet)(checkprofit))
    }
  } else if (action == "transfer"_n.value) {
    execute_action(name(receiver), name(code), &names::ontransfer);
  }
}
