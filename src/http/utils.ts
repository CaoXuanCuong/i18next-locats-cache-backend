export function hasXMLHttpRequest () {
  return (typeof XMLHttpRequest === 'function' || typeof XMLHttpRequest === 'object')
}

/**
 * Convert any value to a Promise than will resolve to this value.
 *
 * @param {*} maybePromise
 *
 * @returns {Promise}
 */
export function makePromise(maybePromise: Promise<string> | string): Promise<string> {
  if (!!maybePromise && typeof maybePromise !== "string" && typeof maybePromise.then === 'function') {
    return maybePromise;
  }

  return Promise.resolve(maybePromise);
}