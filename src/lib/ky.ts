import ky from 'ky'

const kyInstance = ky.extend({
  prefixUrl: 'holix://app',
})

export { kyInstance }
