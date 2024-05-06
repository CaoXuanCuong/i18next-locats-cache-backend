export function hasXMLHttpRequest () {
  return (typeof XMLHttpRequest === 'function' || typeof XMLHttpRequest === 'object')
}

/**
 * Determine whether the given `maybePromise` is a Promise.
 *
 * @param {*} maybePromise
 *
 * @returns {Boolean}
 */
function isPromise(maybePromise: any): Boolean {
  return !!maybePromise && typeof maybePromise.then === 'function'
}

/**
 * Convert any value to a Promise than will resolve to this value.
 *
 * @param {*} maybePromise
 *
 * @returns {Promise}
 */
export function makePromise(maybePromise: any): Promise<string> {
  if (isPromise(maybePromise)) {
    return maybePromise;
  }

  return Promise.resolve(maybePromise);
}