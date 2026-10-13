# Owned synthetic OAuth qualification; no inference or coding delegation.
import json, os, pty, re, select, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

configuration = json.load(open(sys.argv[1]))
environment = dict(os.environ, CLAUDE_CONFIG_DIR=configuration['cwd'], DISABLE_TELEMETRY='1')
client = configuration['client']
name = 'daclify_owned_http'
child = None
master = None

def command(arguments):
    return subprocess.run([client, 'mcp'] + arguments, cwd=configuration['cwd'], env=environment,
                          capture_output=True, text=True, timeout=45)

try:
    added = command(['add', '--scope', 'user', '--transport', 'http', '--client-id',
                     'claude-owned-fixture', '--callback-port', '35839', name, configuration['api'] + '/mcp'])
    if added.returncode: raise RuntimeError('CLAUDE_CONFIG_REFUSED')
    master, slave = pty.openpty()
    child = subprocess.Popen([client, 'mcp', 'login', name, '--no-browser'], cwd=configuration['cwd'],
                             env=environment, stdin=slave, stdout=slave, stderr=slave)
    os.close(slave)
    output = b''
    deadline = time.time() + 45
    authorization = None
    while time.time() < deadline:
        if select.select([master], [], [], .2)[0]:
            output += os.read(master, 65536)
            if len(output) > 1024 * 1024: raise RuntimeError('CLAUDE_OUTPUT_LIMIT')
            match = re.search(re.escape(configuration['api'].encode() + b'/mcp/oauth/authorize?') + rb'[^\x00-\x20\x7f]+', output)
            if match:
                authorization = match.group().decode()
                break
    if not authorization: raise RuntimeError('CLAUDE_AUTHORIZATION_ABSENT')
    query = urllib.parse.parse_qs(urllib.parse.urlparse(authorization).query)
    if query.get('client_id') != ['claude-owned-fixture'] or query.get('redirect_uri') != ['http://localhost:35839/callback']:
        print(json.dumps({'clientId': query.get('client_id'), 'callback': query.get('redirect_uri'), 'queryKeys': sorted(query)}), file=sys.stderr)
        raise RuntimeError('CLAUDE_CALLBACK_MISMATCH')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl): return None
    try:
        urllib.request.build_opener(NoRedirect).open(authorization, timeout=10)
        raise RuntimeError('CLAUDE_CONSENT_REDIRECT_ABSENT')
    except urllib.error.HTTPError as error:
        if error.code != 302: raise RuntimeError('CLAUDE_AUTHORIZATION_REFUSED')
        request_id = urllib.parse.parse_qs(urllib.parse.urlparse(error.headers['Location']).query)['request'][0]
    print(json.dumps({'kind':'consent-request', 'requestId':request_id}), flush=True)
    approved = json.loads(sys.stdin.readline())
    os.write(master, approved['redirectUrl'].encode() + b'\r')
    deadline = time.time() + 45
    while child.poll() is None and time.time() < deadline:
        if select.select([master], [], [], .2)[0]:
            try: output += os.read(master, 65536)
            except OSError: break
            if len(output) > 1024 * 1024: raise RuntimeError('CLAUDE_OUTPUT_LIMIT')
    if child.wait(timeout=5): raise RuntimeError('CLAUDE_LOGIN_REFUSED')
    status = command(['get', name])
    connected = status.returncode == 0 and 'Connected' in status.stdout
    if not connected: raise RuntimeError('CLAUDE_MCP_NOT_CONNECTED')
    version = subprocess.check_output([client, '--version'], env=environment, text=True).strip()
    print(json.dumps({'client':'claude-code', 'version':version, 'connected':connected,
                      'callback':query['redirect_uri'][0], 'inferenceRun':False}))
finally:
    command(['logout', name])
    if child is not None and child.poll() is None:
        child.terminate()
        try: child.wait(timeout=5)
        except subprocess.TimeoutExpired: child.kill(); child.wait()
    if master is not None: os.close(master)
