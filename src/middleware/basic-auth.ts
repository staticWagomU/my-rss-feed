import { Context, Next } from 'hono';

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const encodedA = encoder.encode(a);
  const encodedB = encoder.encode(b);
  
  if (encodedA.byteLength !== encodedB.byteLength) {
    return false;
  }
  
  return Buffer.from(encodedA).equals(Buffer.from(encodedB));
}

export async function basicAuth(c: Context, next: Next) {
  const authorization = c.req.header('Authorization');
  
  if (!authorization || !authorization.startsWith('Basic ')) {
    return c.text('Unauthorized', 401, {
      'WWW-Authenticate': 'Basic realm="RSS Feed Manager"',
    });
  }
  
  const base64Credentials = authorization.substring('Basic '.length);
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(':');
  
  const expectedUsername = c.env.BASIC_USERNAME;
  const expectedPassword = c.env.BASIC_PASSWORD;
  
  if (!expectedUsername || !expectedPassword) {
    console.error('BASIC_USERNAME or BASIC_PASSWORD not configured');
    return c.text('Server configuration error', 500);
  }
  
  const usernameMatch = timingSafeEqual(username, expectedUsername);
  const passwordMatch = timingSafeEqual(password, expectedPassword);
  
  if (!usernameMatch || !passwordMatch) {
    return c.text('Unauthorized', 401, {
      'WWW-Authenticate': 'Basic realm="RSS Feed Manager"',
    });
  }
  
  await next();
}