#include <eosio/eosio.hpp>
#include <eosio/crypto_bls_ext.hpp>
#include <algorithm>
#include <cstring>

using namespace eosio;

// Disposable qualification only; this contract does not accept or count votes.
CONTRACT ballotprobe : public contract {
  static constexpr std::array<uint8_t, 32> order = {
    0x01,0x00,0x00,0x00,0xff,0xff,0xff,0xff,0xfe,0x5b,0xfe,0xff,0x02,0xa4,0xbd,0x53,
    0x05,0xd8,0xa1,0x09,0x08,0xd8,0x39,0x33,0x48,0x7d,0x9d,0x29,0x53,0xa7,0xed,0x73
  };

  static bls_g1 read_point(const std::vector<char>& value) {
    check(value.size() == 96, "BLS_POINT_SIZE");
    bls_g1 result{};
    std::copy(value.begin(), value.end(), result.begin());
    return result;
  }

  static bls_scalar read_scalar(const std::vector<char>& value) {
    check(value.size() == 32, "BLS_SCALAR_SIZE");
    bool less = false;
    for (int i = 31; i >= 0; --i) {
      const auto byte = uint8_t(value[i]);
      if (byte != order[i]) { less = byte < order[i]; break; }
    }
    check(less, "BLS_SCALAR_RANGE");
    bls_scalar result{};
    std::copy(value.begin(), value.end(), result.begin());
    return result;
  }

  void authorize() const {
    require_auth(get_self());
    check(action_data_size() <= 512, "BLS_ACTION_SIZE");
  }

  static bls_scalar group_order() {
    bls_scalar result{};
    std::copy(order.begin(), order.end(), result.begin());
    return result;
  }

  static bool below_order(const bls_scalar& value) {
    for (int i = 31; i >= 0; --i)
      if (uint8_t(value[i]) != order[i]) return uint8_t(value[i]) < order[i];
    return false;
  }

  static bls_scalar scalar_subtract(const bls_scalar& a, const bls_scalar& b) {
    bls_scalar result{};
    int borrow = 0;
    for (size_t i = 0; i < 32; ++i) {
      const int value = int(uint8_t(a[i])) - int(uint8_t(b[i])) - borrow;
      result[i] = char(uint8_t(value));
      borrow = value < 0;
    }
    check(!borrow, "BLS_SCALAR_RANGE");
    return result;
  }

  static bls_scalar scalar_negative(const bls_scalar& value) {
    return value == bls_scalar{} ? value : scalar_subtract(group_order(), value);
  }

  static bls_scalar scalar_sum(const bls_scalar& a, const bls_scalar& b) {
    bls_scalar result{};
    uint16_t carry = 0;
    for (size_t i = 0; i < 32; ++i) {
      const uint16_t value = uint16_t(uint8_t(a[i])) + uint8_t(b[i]) + carry;
      result[i] = char(uint8_t(value));
      carry = value >> 8;
    }
    check(!carry, "BLS_SCALAR_RANGE"); // 2q is less than 2^256.
    return below_order(result) ? result : scalar_subtract(result, group_order());
  }

  static bls_scalar scalar_u64(uint64_t value) {
    bls_scalar result{};
    for (size_t i = 0; i < 8; ++i) { result[i] = char(value & 255); value >>= 8; }
    return result;
  }

  static bls_scalar proof_scalar(const std::vector<char>& proof, size_t offset) {
    check(offset + 32 <= proof.size(), "BLS_PROOF_SIZE");
    return read_scalar(std::vector<char>(proof.begin() + offset, proof.begin() + offset + 32));
  }

  static bls_g1 generator() {
    constexpr std::array<uint8_t,96> bytes = {
      0xbb,0xc6,0x22,0xdb,0x0a,0xf0,0x3a,0xfb,0xef,0x1a,0x7a,0xf9,0x3f,0xe8,0x55,0x6c,
      0x58,0xac,0x1b,0x17,0x3f,0x3a,0x4e,0xa1,0x05,0xb9,0x74,0x97,0x4f,0x8c,0x68,0xc3,
      0x0f,0xac,0xa9,0x4f,0x8c,0x63,0x95,0x26,0x94,0xd7,0x97,0x31,0xa7,0xd3,0xf1,0x17,
      0xe1,0xe7,0xc5,0x46,0x29,0x23,0xaa,0x0c,0xe4,0x8a,0x88,0xa2,0x44,0xc7,0x3c,0xd0,
      0xed,0xb3,0x04,0x2c,0xcb,0x18,0xdb,0x00,0xf6,0x0a,0xd0,0xd5,0x95,0xe0,0xf5,0xfc,
      0xe4,0x8a,0x1d,0x74,0xed,0x30,0x9e,0xa0,0xf1,0xa0,0xaa,0xe3,0x81,0xf4,0xb3,0x08
    };
    bls_g1 result{};
    std::copy(bytes.begin(), bytes.end(), result.begin());
    return result;
  }

  static void require_point(const bls_g1& p, bool allow_identity = true) {
    bls_g1 zero{}, result{};
    if (p == zero) { check(allow_identity, "BLS_IDENTITY"); return; }
    check(bls_g1_add(p, zero, result) == 0, "BLS_POINT");
    const auto q = group_order();
    check(bls_g1_weighted_sum(&p, &q, 1, result) == 0 && result == zero, "BLS_SUBGROUP");
  }

  static bls_g1 linear(const bls_g1& a, const bls_scalar& x, const bls_g1& b, const bls_scalar& y) {
    const bls_g1 points[] = {a, b};
    const bls_scalar scalars[] = {x, y};
    bls_g1 result{};
    check(bls_g1_weighted_sum(points, scalars, 2, result) == 0, "BLS_POINT");
    return result;
  }

  static std::vector<char> point_bytes(const bls_g1& p) { return std::vector<char>(p.begin(), p.end()); }

  static std::pair<bls_g1, bls_g1> read_cipher(const std::vector<char>& value, bool response) {
    check(value.size() == 192, "BLS_CIPHER_SIZE");
    auto r = read_point(std::vector<char>(value.begin(), value.begin() + 96));
    auto s = read_point(std::vector<char>(value.begin() + 96, value.end()));
    require_point(r, !response); require_point(s);
    return {r, s};
  }

  static bls_scalar hash_challenge(const char* tag, const std::vector<char>& context,
                                   std::initializer_list<std::vector<char>> parts) {
    check(context.size() == 32, "BLS_CONTEXT_SIZE");
    std::vector<char> input(tag, tag + std::strlen(tag));
    input.push_back(0);
    input.insert(input.end(), context.begin(), context.end());
    for (const auto& part : parts) input.insert(input.end(), part.begin(), part.end());
    const auto digest = sha256(input.data(), input.size()).extract_as_byte_array();
    bls_scalar result{};
    std::reverse_copy(digest.begin(), digest.end(), result.begin());
    for (int i = 0; i < 3 && !below_order(result); ++i) result = scalar_subtract(result, group_order());
    check(below_order(result), "BLS_SCALAR_RANGE");
    return result;
  }

public:
  using contract::contract;

  ACTION g1add(std::vector<char> left, std::vector<char> right, std::vector<char> expected) {
    authorize();
    const auto a = read_point(left), b = read_point(right), want = read_point(expected);
    bls_g1 result{};
    check(bls_g1_add(a, b, result) == 0, "BLS_POINT");
    check(result == want, "BLS_RESULT");
  }

  ACTION g1mul(std::vector<char> point, std::vector<char> scalar, std::vector<char> expected) {
    authorize();
    const auto p = read_point(point), want = read_point(expected);
    const auto s = read_scalar(scalar);
    bls_g1 result{};
    check(bls_g1_weighted_sum(&p, &s, 1, result) == 0, "BLS_POINT");
    check(result == want, "BLS_RESULT");
  }

  ACTION g1check(std::vector<char> point, bool subgroup) {
    authorize();
    const auto p = read_point(point);
    bls_g1 zero{}, result{};
    check(bls_g1_add(p, zero, result) == 0, "BLS_POINT");
    if (subgroup) {
      bls_scalar q{};
      std::copy(order.begin(), order.end(), q.begin());
      check(bls_g1_weighted_sum(&p, &q, 1, result) == 0 && result == zero, "BLS_SUBGROUP");
    }
  }

  ACTION validkey(std::vector<char> context, std::vector<char> key, std::vector<char> proof) {
    authorize();
    check(proof.size() == 64, "BLS_PROOF_SIZE");
    const auto y = read_point(key); require_point(y, false);
    const auto c = proof_scalar(proof, 0), z = proof_scalar(proof, 32);
    const auto a = linear(generator(), z, y, scalar_negative(c));
    // An identity nonce commitment can expose the secret witness.
    check(a != bls_g1{}, "BLS_PROOF_NONCE");
    check(c == hash_challenge("daclify.quick-ballot.key.v1", context, {key, point_bytes(a)}), "BLS_KEY_PROOF");
  }

  ACTION validvote(std::vector<char> context, std::vector<char> key, std::vector<char> ciphertext, std::vector<char> proof) {
    authorize();
    check(proof.size() == 128, "BLS_PROOF_SIZE");
    const auto y = read_point(key); require_point(y, false);
    const auto [r, s] = read_cipher(ciphertext, true);
    const auto c0 = proof_scalar(proof, 0), z0 = proof_scalar(proof, 32);
    const auto c1 = proof_scalar(proof, 64), z1 = proof_scalar(proof, 96);
    const auto g = generator();
    const auto a0 = linear(g, z0, r, scalar_negative(c0));
    const auto b0 = linear(y, z0, s, scalar_negative(c0));
    const auto a1 = linear(g, z1, r, scalar_negative(c1));
    const auto s_minus_g = linear(s, scalar_u64(1), g, scalar_negative(scalar_u64(1)));
    const auto b1 = linear(y, z1, s_minus_g, scalar_negative(c1));
    check(a0 != bls_g1{} && b0 != bls_g1{} && a1 != bls_g1{} && b1 != bls_g1{}, "BLS_PROOF_NONCE");
    check(scalar_sum(c0, c1) == hash_challenge("daclify.quick-ballot.response.v1", context,
      {key, ciphertext, point_bytes(a0), point_bytes(b0), point_bytes(a1), point_bytes(b1)}), "BLS_VOTE_PROOF");
  }

  ACTION validtally(std::vector<char> context, std::vector<char> key, std::vector<char> ciphertext,
                    uint64_t count, uint64_t up, std::vector<char> proof) {
    authorize();
    check(up <= count, "BLS_TALLY_BOUNDS");
    check(proof.size() == 64, "BLS_PROOF_SIZE");
    const auto y = read_point(key); require_point(y, false);
    const auto [r, s] = read_cipher(ciphertext, false);
    const auto c = proof_scalar(proof, 0), z = proof_scalar(proof, 32);
    const auto g = generator();
    const auto d = linear(s, scalar_u64(1), g, scalar_negative(scalar_u64(up)));
    const auto a = linear(g, z, y, scalar_negative(c));
    const auto b = linear(r, z, d, scalar_negative(c));
    check(a != bls_g1{}, "BLS_PROOF_NONCE"); // b may be identity when the aggregate r is identity.
    check(c == hash_challenge("daclify.quick-ballot.tally.v1", context,
      {key, ciphertext, pack(std::make_tuple(count, up)), point_bytes(a), point_bytes(b)}), "BLS_TALLY_PROOF");
  }
};

EOSIO_DISPATCH(ballotprobe, (g1add)(g1mul)(g1check)(validkey)(validvote)(validtally))
