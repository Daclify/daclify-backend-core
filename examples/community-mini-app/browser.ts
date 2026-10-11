import { ConnectedAppClient } from '@daclify/core-protocol/connected-apps';
import {
  CommunityActivityClient,
  ActivityIntentSchema,
  type ActivityIntent,
} from '@daclify/modules/sdk';
import { z } from 'zod';
const config = z
    .object({
      issuer: z.string(),
      clientId: z.string(),
      redirectUri: z.string(),
      activityAccount: z.string(),
      frontendOrigin: z.string(),
    })
    .parse(await (await fetch('/config')).json()),
  client = new ConnectedAppClient(config),
  activity = new CommunityActivityClient(client, config.activityAccount);
function element(id: string) {
  const found = document.getElementById(id);
  if (!found) throw new Error('PAGE_ELEMENT');
  return found;
}
function status(value: string) {
  element('status').textContent = value;
}
async function request(path: string, method = 'GET') {
  const response = await fetch(path, {
    method,
    headers: await client.appAuthorization(),
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('APP_REQUEST_DENIED');
  return response.json();
}
async function deliver(intent: ActivityIntent) {
  const result = await activity.deliver(intent);
  if (result.status === 'confirmed') {
    await request('/v1/confirm/' + intent.eventId, 'POST');
    status(
      intent.action === 'askreview'
        ? 'Review submission confirmed on Daclify. Check the task state after manager review.'
        : 'Completion confirmed on Daclify.',
    );
  } else
    status(
      'Saved in this app; Daclify confirmation is pending. Sign in and retry to send the same event.',
    );
}
async function load() {
  const tasks = z
    .array(z.object({ id: z.string(), title: z.string(), state: z.string() }))
    .parse(await request('/v1/tasks'));
  element('tasks').replaceChildren();
  for (const task of tasks) {
    const article = document.createElement('article'),
      title = document.createElement('h2'),
      button = document.createElement('button');
    title.textContent = task.title + ' · ' + task.state;
    button.textContent = task.state !== 'open' ? 'Check confirmation or review' : 'Complete';
    button.onclick = async () => {
      button.disabled = true;
      try {
        await deliver(
          ActivityIntentSchema.parse(
            await request('/v1/complete/' + encodeURIComponent(task.id), 'POST'),
          ),
        );
        await load();
      } catch (error) {
        status(error instanceof Error ? error.message : 'App unavailable');
      } finally {
        button.disabled = false;
      }
    };
    const evidence = document.createElement('button');
    evidence.textContent = 'Complete with encrypted snapshot';
    evidence.onclick = async () => {
      try {
        const intent = z
          .object({ eventId: z.string() })
          .parse(
            await request('/v1/complete/' + encodeURIComponent(task.id) + '?evidence=1', 'POST'),
          );
        window.open(
          config.frontendOrigin +
            '/apps/evidence?clientId=' +
            config.clientId +
            '&event=' +
            intent.eventId,
          'daclify-evidence',
          'popup,width=540,height=760',
        );
        status('Approve the snapshot in Daclify, then retry confirmation here.');
        await load();
      } catch (error) {
        status(error instanceof Error ? error.message : 'Snapshot unavailable');
      }
    };
    const review = document.createElement('button');
    review.textContent = 'Submit for review';
    review.disabled = task.state !== 'open';
    review.onclick = async () => {
      try {
        await deliver(
          ActivityIntentSchema.parse(
            await request('/v1/complete/' + encodeURIComponent(task.id) + '?review=1', 'POST'),
          ),
        );
        await load();
      } catch (error) {
        status(error instanceof Error ? error.message : 'Review unavailable');
      }
    };
    article.append(title, button, review, evidence);
    element('tasks').append(article);
  }
}
let popup: Window | null = null;
element('login').onclick = () => {
  popup = window.open(
    client.beginLogin({ recording: true, grantSeconds: 3600 }),
    'daclify-consent',
    'popup,width=520,height=740',
  );
  if (!popup) status('Allow this sign-in popup, then try again.');
};
window.addEventListener('message', async (event) => {
  if (event.origin !== location.origin || event.source !== popup) return;
  const message = z.object({ callback: z.string() }).safeParse(event.data);
  if (!message.success) return;
  try {
    await client.finishLogin(message.data.callback);
    popup?.close();
    popup = null;
    status('Active DAO membership verified.');
    await load();
  } catch (error) {
    status(error instanceof Error ? error.message : 'Sign-in failed');
  }
});
element('logout').onclick = async () => {
  await client.logout();
  element('tasks').replaceChildren();
  status('Signed out; app signing key cleared.');
};
