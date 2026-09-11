import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the real handler with a simulated Google SDK; no API key or billing.
const source = (await readFile(new URL('../api/gemini.js', import.meta.url), 'utf8'))
  .replace('import { GoogleGenerativeAI } from "@google/generative-ai";', '')
  .replace('export const config', 'const config')
  .replace('export default async function handler', 'async function handler');

async function request(errors = []) {
  const calls = [];
  const context = vm.createContext({
    process: { env: { GEMINI_API_KEY: 'test-key' } },
    setTimeout: (callback) => callback(),
    GoogleGenerativeAI: class {
      getGenerativeModel({ model }) {
        return { generateContent: async (prompt) => {
          calls.push({ model, prompt });
          const error = errors.shift();
          if (error) throw new Error(error);
          return { response: { text: () => 'Bonjour !' } };
        } };
      }
    },
  });
  vm.runInContext(source, context);
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await context.handler({ method: 'POST', body: { prompt: 'Bonjour' } }, res);
  return { calls, res };
}

test('chat returns text using the supported default model', async () => {
  const { calls, res } = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.text, 'Bonjour !');
  assert.equal(res.body.model, 'gemini-2.5-flash');
  assert.equal(calls[0].prompt, 'Bonjour');
});

test('unavailable models fall back to another supported text model', async () => {
  const { calls, res } = await request(['404 Not Found', '404 Not Found']);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.model, 'gemini-3.1-flash-lite');
  assert.equal(calls.length, 3);
});

test('authentication failure does not trigger model fallback', async () => {
  const { calls, res } = await request(['403 Forbidden']);
  assert.equal(res.statusCode, 500);
  assert.equal(calls.length, 1);
});

test('quota errors retain bounded retries and the user retry notice', async () => {
  const { calls, res } = await request(Array(3).fill('429 Too many requests'));
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['Retry-After'], '60');
  assert.equal(calls.length, 3);
  assert.ok(calls.every(({ model }) => model === 'gemini-2.5-flash'));
});
