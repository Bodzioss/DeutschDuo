import { describe, expect, test } from 'vitest';
import { pushState, urlBase64ToUint8Array } from '@/data/push';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const base = { ua: ANDROID, standalone: false, hasPush: true, permission: 'default' as NotificationPermission | 'n/a', subscribed: false };

describe('pushState', () => {
  test('iPhone Safari, not installed → ios-not-installed', () =>
    expect(pushState({ ...base, ua: IPHONE, standalone: false, hasPush: false, permission: 'n/a' })).toBe('ios-not-installed'));
  test('iPhone standalone, permission default, not subscribed → off', () =>
    expect(pushState({ ...base, ua: IPHONE, standalone: true })).toBe('off'));
  test('Android Chrome granted + subscribed → on', () =>
    expect(pushState({ ...base, permission: 'granted', subscribed: true })).toBe('on'));
  test('no PushManager → unsupported', () => expect(pushState({ ...base, hasPush: false, permission: 'n/a' })).toBe('unsupported'));
  test('denied → denied', () => expect(pushState({ ...base, permission: 'denied' })).toBe('denied'));
  test('granted but not subscribed → off', () => expect(pushState({ ...base, permission: 'granted' })).toBe('off'));
});

describe('urlBase64ToUint8Array', () => {
  test('decodes base64url without padding', () => {
    // "hi?" → base64 "aGk/" → base64url "aGk_"
    expect(Array.from(urlBase64ToUint8Array('aGk_'))).toEqual([104, 105, 63]);
    expect(Array.from(urlBase64ToUint8Array('aGk'))).toEqual([104, 105]);
  });
});
