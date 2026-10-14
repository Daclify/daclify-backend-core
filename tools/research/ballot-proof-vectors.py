"""Independent synthetic public vectors; never use these nonces/keys for voting."""
import hashlib
import json
from pathlib import Path

fixture = Path('tests/fixtures/ballot-proof-vectors.json')
data = json.loads(fixture.read_text())
p, q = int(data['field']), int(data['order'])
raw = bytes.fromhex(data['generator'])
G = (int.from_bytes(raw[:48], 'little'), int.from_bytes(raw[48:], 'little'))


def add(a, b):
    if a is None:
        return b
    if b is None:
        return a
    x, y = a
    u, v = b
    if x == u and (y + v) % p == 0:
        return None
    slope = (3*x*x * pow(2*y, -1, p) if a == b else (v-y) * pow(u-x, -1, p)) % p
    result_x = (slope*slope-x-u) % p
    return result_x, (slope*(x-result_x)-y) % p


def scale(a, n):
    result = None
    n %= q
    while n:
        if n & 1:
            result = add(result, a)
        a = add(a, a)
        n >>= 1
    return result


def neg(a):
    return None if a is None else (a[0], (-a[1]) % p)


def encoded(a):
    return bytes(96) if a is None else a[0].to_bytes(48, 'little') + a[1].to_bytes(48, 'little')


def scalar(n):
    return (n % q).to_bytes(32, 'little')


def challenge(tag, context, *parts):
    return int.from_bytes(hashlib.sha256(tag.encode() + b'\0' + bytes.fromhex(context) + b''.join(parts)).digest(), 'big') % q


def synthetic(label):
    return 1 + int.from_bytes(hashlib.sha256(label.encode()).digest(), 'big') % (q-1)


x = 42  # Public synthetic fixture secret, not an account or production key.
Y = scale(G, x)
key_context = '31' * 32
w = synthetic('key proof nonce')
c = challenge('daclify.quick-ballot.key.v1', key_context, encoded(Y), encoded(scale(G, w)))
key = {'context': key_context, 'publicKey': encoded(Y).hex(), 'proof': (scalar(c) + scalar(w+c*x)).hex()}


def vote(label, bit, r, zero_nonce=False, zero_simulation=False):
    context = hashlib.sha256(label.encode()).hexdigest()
    R, S = scale(G, r), add(scale(Y, r), scale(G, bit))
    j = 1-bit
    challenges = [0, 0]
    responses = [0, 0]
    commitments = [None, None]
    challenges[j], responses[j] = synthetic(label+' c'), synthetic(label+' z')
    if zero_simulation:
        challenges[j], responses[j] = 0, 0
    commitments[j] = (
        add(scale(G, responses[j]), neg(scale(R, challenges[j]))),
        add(scale(Y, responses[j]), neg(scale(add(S, neg(scale(G, j))), challenges[j]))),
    )
    nonce = 0 if zero_nonce else synthetic(label+' w')
    commitments[bit] = (scale(G, nonce), scale(Y, nonce))
    transcript = [encoded(Y), encoded(R), encoded(S)]
    for a, b in commitments:
        transcript.extend([encoded(a), encoded(b)])
    h = challenge('daclify.quick-ballot.response.v1', context, *transcript)
    challenges[bit] = (h-challenges[j]) % q
    responses[bit] = (nonce+challenges[bit]*r) % q
    proof = b''.join(scalar(n) for n in [challenges[0], responses[0], challenges[1], responses[1]])
    value = {'context': context, 'choice': bit, 'ciphertext': (encoded(R)+encoded(S)).hex(), 'proof': proof.hex()}
    return value, (R, S)


def tally(label, aggregate, count, up, zero_nonce=False):
    context = hashlib.sha256(label.encode()).hexdigest()
    R, S = aggregate
    assert S == add(scale(R, x), scale(G, up))
    nonce = 0 if zero_nonce else synthetic(label+' w')
    c = challenge('daclify.quick-ballot.tally.v1', context, encoded(Y), encoded(R), encoded(S), count.to_bytes(8, 'little'), up.to_bytes(8, 'little'), encoded(scale(G, nonce)), encoded(scale(R, nonce)))
    return {'context': context, 'ciphertext': (encoded(R)+encoded(S)).hex(), 'count': str(count), 'up': str(up), 'proof': (scalar(c)+scalar(nonce+c*x)).hex()}


votes, points = [], []
for i, (bit, r) in enumerate([(1, 17), (0, 23), (1, 31)]):
    value, pair = vote(f'initial voter {i}', bit, r)
    votes.append(value)
    points.append(pair)
R = S = None
for a, b in points:
    R, S = add(R, a), add(S, b)
replacement, pair = vote('changed voter 2 revision 2', 0, 47)
changed = (add(add(R, neg(points[2][0])), pair[0]), add(add(S, neg(points[2][1])), pair[1]))
removed = (add(changed[0], neg(pair[0])), add(changed[1], neg(pair[1])))
data['proofCases'] = {
    'provenance': 'Python standard-library affine BLS12-381 arithmetic and hashlib, independent of Noble and CDT. Synthetic known key/nonces only; no production keys or voter data.',
    'key': key,
    'votes': votes + [replacement],
    'tallies': [tally('initial frozen set', (R, S), 3, 2), tally('changed frozen set', changed, 3, 1), tally('removed frozen set', removed, 2, 1), tally('empty frozen set', (None, None), 0, 0), tally('cancelled nonce aggregate', (None, G), 2, 1)],
}
unsafe_c = challenge('daclify.quick-ballot.key.v1', key_context, encoded(Y), encoded(None))
data['proofCases']['unsafeKey'] = {**key, 'proof': (scalar(unsafe_c)+scalar(unsafe_c*x)).hex()}
data['proofCases']['unsafeVotes'] = [vote('zero real proof nonce', 1, 59, zero_nonce=True)[0], vote('zero simulated proof commitments', 0, 61, zero_simulation=True)[0]]
data['proofCases']['unsafeTally'] = tally('zero tally proof nonce', (R, S), 3, 2, zero_nonce=True)
assert encoded(add(G, G)).hex() == data['double']
fixture.write_text(json.dumps(data, indent=2)+'\n')
