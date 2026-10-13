# Owned synthetic harness qualification. No inference turn or coding delegation is started.
import os,sys,json,subprocess,pty,fcntl,termios,selectors,time,urllib.request,urllib.error,urllib.parse
configuration=json.load(open(sys.argv[1]))
master,slave=pty.openpty()
def setup_tty():
 os.setsid();fcntl.ioctl(slave,termios.TIOCSCTTY,0)
suffix=''.join(character if character.isalnum() else '_' for character in os.path.basename(configuration['cwd']))
server='daclify_owned_qualification_'+suffix;remote='daclify_owned_http_'+suffix
remote_config=', '+remote+'={url='+json.dumps(configuration['api']+'/mcp')+',required=false,oauth={client_id="codex-owned-fixture",callback_url="http://127.0.0.1:35829/callback",callback_port=35829}}'
args=['codex','app-server','--stdio','-c','analytics.enabled=false','-c','features.apps=false','-c','mcp_servers={'+server+'={command="node",args='+json.dumps(configuration['args'])+',required=true,startup_timeout_sec=30,tool_timeout_sec=30}'+remote_config+'}']
host=subprocess.Popen(['node']+configuration['serveArgs'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,preexec_fn=setup_tty,pass_fds=(slave,))
child=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
os.close(slave)
selector=selectors.DefaultSelector();selector.register(child.stdout,selectors.EVENT_READ,'rpc');selector.register(child.stderr,selectors.EVENT_READ,'diagnostics');selector.register(master,selectors.EVENT_READ,'terminal');selector.register(host.stderr,selectors.EVENT_READ,'host')
buffers={'rpc':b'','diagnostics':b'','terminal':b'','host':b''};sequence=0;responses={}
def send(method,params=None,notification=False):
 global sequence
 sequence+=1;value={'method':method}
 if params is not None:value['params']=params
 if not notification:value['id']=sequence
 child.stdin.write((json.dumps(value)+'\n').encode());child.stdin.flush();return sequence
messages=[];terminal_prompts=0
def poll(deadline):
 global terminal_prompts
 for key,_ in selector.select(max(0,min(.2,deadline-time.time()))):
  try:data=os.read(key.fileobj if isinstance(key.fileobj,int)else key.fileobj.fileno(),65536)
  except OSError:continue
  if not data:continue
  label=key.data;buffers[label]+=data
  if len(buffers[label])>1024*1024:raise RuntimeError('HARNESS_OUTPUT_LIMIT')
  if label=='terminal' and b'Unlock local Daclify delegate:' in buffers[label]:
   terminal_prompts+=1
   os.write(master,configuration['password'].encode()+b'\r');buffers[label]=b''
  if label=='rpc':
   while b'\n' in buffers[label]:
    line,buffers[label]=buffers[label].split(b'\n',1)
    try:value=json.loads(line)
    except ValueError:continue
    if 'id' in value:responses[str(value['id'])]=value
    else:messages.append(value)
def request(method,params):
 ident=send(method,params);deadline=time.time()+50
 while str(ident)not in responses and time.time()<deadline:poll(deadline)
 value=responses.pop(str(ident),None)
 if not value:raise RuntimeError('HARNESS_TIMEOUT_'+method)
 if 'error'in value:
  indicators={word:word.encode().lower() in buffers['diagnostics'].lower() for word in ['Daclify MCP could not continue','timed out','No such device','permission denied','initialize']};print(json.dumps({'failedMethod':method,'rpcCode':value['error'].get('code'),'terminalPrompts':terminal_prompts,'indicators':indicators}),file=sys.stderr)
  raise RuntimeError('HARNESS_RPC_REFUSED_'+method)
 return value.get('result')
try:
 deadline=time.time()+20
 while b'Daclify companion ready'not in buffers['host'] and time.time()<deadline:poll(deadline)
 if b'Daclify companion ready'not in buffers['host']:raise RuntimeError('HARNESS_COMPANION_UNAVAILABLE')
 request('initialize',{'clientInfo':{'name':'daclify-owned-mcp-test','version':'1'},'capabilities':{'experimentalApi':True}});send('initialized',notification=True)
 thread=request('thread/start',{'cwd':configuration['cwd'],'ephemeral':True,'sandbox':'read-only','approvalPolicy':'never'})
 thread_id=thread['thread']['id']
 status=request('mcpServerStatus/list',{'threadId':thread_id,'serverName':server,'detail':'toolsAndAuthOnly'})
 def call(tool,arguments,target=server):
  result=request('mcpServer/tool/call',{'threadId':thread_id,'server':target,'tool':tool,'arguments':arguments})
  if result.get('isError'):raise RuntimeError('HARNESS_TOOL_REFUSED_'+tool)
  return json.loads(result['content'][0]['text'])
 member=call('get_membership',{});prepared=call('prepare_vote',configuration['intent']);result=call('submit_prepared',prepared)
 login=request('mcpServer/oauth/login',{'name':remote,'scopes':['daclify:read','daclify:prepare','daclify:submit'],'timeoutSecs':60})
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,req,fp,code,msg,headers,newurl):return None
 try:urllib.request.build_opener(NoRedirect).open(login['authorizationUrl'],timeout=10);raise RuntimeError('HARNESS_CONSENT_REDIRECT_ABSENT')
 except urllib.error.HTTPError as error:
  if error.code!=302:raise RuntimeError('HARNESS_AUTHORIZATION_REFUSED')
  location=error.headers['Location']
 request_id=urllib.parse.parse_qs(urllib.parse.urlparse(location).query)['request'][0]
 print(json.dumps({'kind':'consent-request','requestId':request_id}),flush=True)
 approved=json.loads(sys.stdin.readline());urllib.request.urlopen(approved['redirectUrl'],timeout=10).read()
 deadline=time.time()+30
 while not any(value.get('method')=='mcpServer/oauthLogin/completed' and value.get('params',{}).get('name')==remote for value in messages)and time.time()<deadline:poll(deadline)
 completion=next((value['params']for value in messages if value.get('method')=='mcpServer/oauthLogin/completed' and value.get('params',{}).get('name')==remote),None)
 if not completion or not completion.get('success'):raise RuntimeError('HARNESS_OAUTH_INCOMPLETE')
 request('config/mcpServer/reload',None)
 thread=request('thread/start',{'cwd':configuration['cwd'],'ephemeral':True,'sandbox':'read-only','approvalPolicy':'never'})
 thread_id=thread['thread']['id']
 member_remote=call('get_membership',{},remote);prepared_remote=call('prepare_vote',configuration['remoteIntent'],remote)
 print(json.dumps({'kind':'external-signature-request','prepared':prepared_remote}),flush=True);signature=json.loads(sys.stdin.readline())['signature']
 remote_result=call('submit_signed',{'prepared':prepared_remote,'signature':signature},remote)
 print(json.dumps({'client':'codex-cli','version':subprocess.check_output(['codex','--version'],text=True).strip(),'memberId':member['memberId'],'preparedId':prepared['id'],'result':result,'statusCount':len(status['data']),'remoteResult':remote_result,'remoteMemberId':member_remote['memberId']}))
finally:
 try:subprocess.run(['codex','mcp','logout',remote,'-c',args[-1]],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10,check=False)
 except subprocess.TimeoutExpired:pass
 child.terminate()
 try:child.wait(timeout=10)
 except subprocess.TimeoutExpired:child.kill();child.wait()
 host.terminate()
 try:host.wait(timeout=10)
 except subprocess.TimeoutExpired:host.kill();host.wait()
 os.close(master)
