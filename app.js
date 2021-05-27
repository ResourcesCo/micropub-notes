const Koa = require('koa');
const Router = require('@koa/router');
const serve = require('koa-static');
const bodyParser = require('koa-bodyparser');
const fetch = require('isomorphic-unfetch');
const randomBytes = require('crypto').randomBytes;

const app = new Koa();
const router = new Router();

const gitea = {
  apiBase: process.env.GITEA_API_BASE,
  user: process.env.GITEA_USER,
  repo: process.env.GITEA_REPO,
  token: process.env.GITEA_TOKEN,
};

async function createNote(name, contentPlain) {
  const content = Buffer.from(contentPlain).toString('base64');
  const body = JSON.stringify({content});
  const url = `${gitea.apiBase}/repos/${gitea.user}/${gitea.repo}/contents/${name}.txt`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `token ${gitea.token}`,
    },
    body,
  });
  console.log({url, resp});
}

async function appendNote(content) {
  const originalResp = await fetch(`${gitea.apiBase}/repos/${gitea.user}/${gitea.repo}/contents/notes.txt`, {
    headers: {
      Accept: 'application/json',
      Authorization: `token ${gitea.token}`,
    },
  });
  const originalData = await originalResp.json();
  const originalContentPlain = Buffer.from(originalData.content, 'base64').toString('utf8');
  const newContentPlain = originalContentPlain + "\n\n" + content;
  const newContent = Buffer.from(newContentPlain).toString('base64');
  const body = JSON.stringify({content: newContent, sha: originalData.sha});
  const resp = await fetch(`${gitea.apiBase}/repos/${gitea.user}/${gitea.repo}/contents/notes.txt`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `token ${gitea.token}`,
    },
    body,
  });
}

router.post('/micropub', async (ctx, next) => {
  const resp = await fetch('https://tokens.indieauth.com/token', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: ctx.headers['authorization']
    }
  });
  const data = await resp.json();
  if (!resp.ok) {
    next();
    return;
  }
  const name = randomBytes(12).toString('hex');
  await createNote(name, ctx.request.body.content);
  ctx.set('Location', `https://${name}.benatkin.com/`);
  ctx.status = 201;
  ctx.body = {};
});

router.get('/', async (ctx, next) => {
  const host = (ctx.headers['host'] || '').replace(/\.[^.]+\.[^.*]+$/, '')
  if (host === 'notes') {
    return await next();
  }
  const url = `${gitea.apiBase}/repos/${gitea.user}/${gitea.repo}/contents/${encodeURIComponent(host)}.txt`;
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `token ${gitea.token}`,
    },
  });
  console.log({url, resp});
  if (resp.ok) {
    const { content } = await resp.json();
    const contentPlain = Buffer.from(content, 'base64').toString('utf8');
    ctx.body = contentPlain;
  } else {
    ctx.status = 404;
    ctx.body = `${host} not found`;
  }
})

router.get('/api/notes', async (ctx, next) => {
  const resp = await fetch(`${gitea.apiBase}/repos/${gitea.user}/${gitea.repo}/contents/notes.txt`, {
    headers: {
      Accept: 'application/json',
      Authorization: `token ${gitea.token}`,
    },
  });
  const { content } = await resp.json();
  const contentPlain = Buffer.from(content, 'base64').toString('utf8');
  ctx.body = { content: contentPlain };
});

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())
  .use(serve('static'));

app.listen(3000);
