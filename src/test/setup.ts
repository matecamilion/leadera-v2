import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom no implementa scrollTo y lo avisa por consola en cada cambio de paso.
window.scrollTo = () => {}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})
