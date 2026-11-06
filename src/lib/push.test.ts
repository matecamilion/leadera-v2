import { describe, expect, it } from 'vitest'
import { urlBase64ToUint8Array } from './push'

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url sin relleno', () => {
    // "hello?>" en base64 es aGVsbG8/Pg==; en base64url: aGVsbG8_Pg
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8_Pg'))).toEqual([104, 101, 108, 108, 111, 63, 62])
  })

  it('traduce - y _ a + y /', () => {
    expect(Array.from(urlBase64ToUint8Array('-_-_'))).toEqual([251, 255, 191])
  })

  it('una clave VAPID típica da 65 bytes', () => {
    const clave = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    expect(urlBase64ToUint8Array(clave)).toHaveLength(65)
  })
})
