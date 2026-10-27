import type { PostPayload } from '../api/PostsApi';

const validPost = { title: 'Streamhub QA assessment', body: 'Boundary testing for POST /posts', userId: 1 };

const repeat = (length: number) => 'A'.repeat(length);

/**
 * Named payloads referenced from features/api/create-post.feature. Keeping them here (rather than
 * inline in Gherkin) lets the feature read as a spec while the data stays precise and reviewable.
 */
export const POST_PAYLOADS: Record<string, PostPayload> = {
  'a valid post': { kind: 'json', description: 'All required fields with sensible values', body: validPost },

  // --- Excessively long strings -----------------------------------------------------------
  'a 10,000 character title': { kind: 'json', description: 'Title well beyond any reasonable UI limit', body: { ...validPost, title: repeat(10_000) } },
  'a 100,000 character title': { kind: 'json', description: '~100 KB title', body: { ...validPost, title: repeat(100_000) } },
  'a 1,000,000 character title': { kind: 'json', description: '~1 MB title — payload-size boundary', body: { ...validPost, title: repeat(1_000_000) } },

  // --- Unsupported / dangerous characters ---------------------------------------------------
  'an HTML script tag in the title': { kind: 'json', description: 'Stored-XSS probe', body: { ...validPost, title: '<script>alert("xss")</script>' } },
  'a SQL injection string in the title': { kind: 'json', description: 'Classic SQLi probe', body: { ...validPost, title: "Robert'); DROP TABLE posts;--" } },
  'control characters in the title': { kind: 'json', description: 'NUL, BEL and escape characters', body: { ...validPost, title: 'bad\u0000title\u0007with\u001bcontrols' } },
  'emoji and right-to-left override characters in the title': { kind: 'json', description: 'Multi-byte + bidi spoofing characters', body: { ...validPost, title: 'pay 😀 ‮gnp.exe‬ ​' } },

  // --- Missing required fields ----------------------------------------------------------------
  'no userId': { kind: 'json', description: 'userId omitted', body: { title: validPost.title, body: validPost.body } },
  'no title': { kind: 'json', description: 'title omitted', body: { body: validPost.body, userId: 1 } },
  'an empty object': { kind: 'json', description: 'No fields at all', body: {} },

  // --- Wrong types ------------------------------------------------------------------------------
  'a non-numeric userId': { kind: 'json', description: 'userId as a string', body: { ...validPost, userId: 'abc' } },
  'a JSON array instead of an object': { kind: 'json', description: 'Top-level array body', body: [1, 2, 3] },

  // --- Malformed bodies (should never reach application code) -----------------------------
  'malformed JSON': { kind: 'raw', description: 'Truncated JSON document', body: '{"title": "unterminated", ' },
  'invalid UTF-8 bytes': { kind: 'raw', description: 'Byte sequence that is not valid UTF-8', body: Buffer.from([0xff, 0xfe, 0x7b, 0x7d]) },
};

export function payloadFor(name: string): PostPayload {
  const payload = POST_PAYLOADS[name];
  if (!payload) {
    throw new Error(`Unknown payload "${name}". Known payloads: ${Object.keys(POST_PAYLOADS).join(', ')}`);
  }
  return payload;
}
