import { ReadCallback } from "i18next";
import { LocatsCacheBackendOptions } from "../";
import request from '../http/request'
import { makePromise } from '../http/utils'

class Storage {
  store: any;
  constructor(options: LocatsCacheBackendOptions) {
    this.store = options.store;
  }

  setItem(key: string, value: string) {
    if (this.store) {
      try {
        this.store.setItem(key, value);
      } catch (e) {
      }
    }
  }

  getItem(key: string, value?: string) {
    if (this.store) {
      try {
        return this.store.getItem(key, value);
      } catch (e) {
      }
    }
    return undefined
  }
}

function getDefaults(): LocatsCacheBackendOptions {
  let store = null;
  try {
    store = window.localStorage;
  } catch (e) {
    if (typeof window !== 'undefined') {
      console.log('Failed to load local storage.', e)
    }
  }
  return {
    prefix: 'locats_res_',
    checkEtagPath: '',
    expirationTime: 7 * 24 * 60 * 60 * 1000,
    defaultVersion: undefined,
    versions: {},
    store,
    loadPath: '/locales/{{lng}}/{{ns}}.json',
    addPath: '/locales/add/{{lng}}/{{ns}}',
    parse: data => JSON.parse(data),
    parsePayload: (namespace, key, fallbackValue) => ({ [key]: fallbackValue || '' }),
    parseLoadPayload: (languages, namespaces) => undefined,
    request,
    reloadInterval: typeof window !== 'undefined' ? false : 60 * 60 * 1000,
    customHeaders: {},
    queryStringParams: {},
    crossDomain: false, // used for XmlHttpRequest
    withCredentials: false, // used for XmlHttpRequest
    overrideMimeType: false, // used for XmlHttpRequest
    requestOptions: { // used for fetch
      mode: 'cors',
      credentials: 'same-origin',
      cache: 'default'
    }
  }
}

class Cache {
  static type: "backend";
  type: string;
  services: any;
  options: LocatsCacheBackendOptions;
  storage?: Storage;
  constructor(services?: any, options?: LocatsCacheBackendOptions) {
    this.options = getDefaults();
    this.init(services, options);
    this.type = 'backend';
  }

  init(services?: any, options?: LocatsCacheBackendOptions) {
    this.services = services;
    this.options = { ...this.options, ...options };
    this.storage = new Storage(this.options);
  }

  read(language: string, namespace: string, callback: ReadCallback) {
    let nowMS = Date.now();
    if (!this.storage || !this.storage.store) {
      return callback(null, null);
    }
    let local = this.storage.getItem("".concat(this.options.prefix || "locats_res_").concat(language, "-").concat(namespace));
    if (local) {
      local = JSON.parse(local);
      let version = this.getVersion(language);
      if (
        local.i18nStamp && local.i18nStamp + this.options.expirationTime > nowMS &&
        version === local.i18nVersion
      ) {
        let i18nVersion = local.i18nVersion;
        let i18nStamp = local.i18nStamp;
        let i18LocatsEtag = local.i18LocatsEtag;
        delete local.i18nVersion;
        delete local.i18nStamp;
        delete local.i18LocatsEtag;
        if (this.options.checkEtagPath) {
          const url = this.services.interpolator.interpolate(this.options.checkEtagPath, { lng: language, ns: namespace })
          fetch(url, {
            method: "GET",
            // Cache-Control header
            headers: {
              'If-None-Match': i18LocatsEtag,
            },
          })
            .then(async (response) => {
              if (response.status === 200) {
                const json = await response.json();
                json.i18nStamp = i18nVersion;
                json.i18nStamp = i18nStamp;
                json.i18LocatsEtag = response.headers.get("etag");
                this.storage?.setItem("".concat(this.options?.prefix || "locats_res_").concat(language, "-").concat(namespace), JSON.stringify(json));
                await new Promise(resolve => setTimeout(resolve, 5000));
                return callback(null, json);
              }
            })
        }
        return callback(null, local);
      }
    }
    return callback(null, null);
  }

  _readAny (languages: string[], loadUrlLanguages: string[] | string, namespaces: string[], loadUrlNamespaces: string[] | string, callback: ReadCallback) {
    let loadPath = this.options.loadPath as string | Promise<string>;
    if (typeof this.options.loadPath === 'function') {
      loadPath = this.options.loadPath(languages, namespaces);
    }

    loadPath = makePromise(loadPath);

    loadPath.then(resolvedLoadPath => {
      if (!resolvedLoadPath) return callback(null, {})
      const url = this.services.interpolator.interpolate(resolvedLoadPath, { lng: languages.join('+'), ns: namespaces.join('+') })
      this.loadUrl(url, callback, loadUrlLanguages, loadUrlNamespaces)
    })
  }

  loadUrl (url: string, callback: ReadCallback, languages: string[] | string, namespaces: string[] | string) {
    const lng = (typeof languages === 'string') ? [languages] : languages
    const ns = (typeof namespaces === 'string') ? [namespaces] : namespaces
    // parseLoadPayload — default undefined
    const payload = this.options.parseLoadPayload ? this.options.parseLoadPayload(lng, ns) : {};
    if(this.options.request) {
      this.options.request(this.options, url, payload, (err: Error, res: Response) => {
        if (res && ((res.status >= 500 && res.status < 600) || !res.status)) return callback('failed loading ' + url + '; status code: ' + res.status, true /* retry */)
        if (res && res.status >= 400 && res.status < 500) return callback('failed loading ' + url + '; status code: ' + res.status, false /* no retry */)
        if (!res && err && err.message && err.message.indexOf('Failed to fetch') > -1) return callback('failed loading ' + url + ': ' + err.message, true /* retry */)
        if (err) return callback(err, false)
  
        let ret, parseErr
        try {
          if (typeof res.data === 'string' && this.options.parse) {
            ret = this.options.parse(res.data, languages, namespaces)
          } else { // fallback, which omits calling the parse function
            ret = res.data
          }
        } catch (e) {
          parseErr = 'failed parsing ' + url + ' to json'
        }
        if (parseErr) return callback(parseErr, false)
        callback(null, ret)
      })
    }
  }

  save(language: string, namespace: string, data: any) {
    if (this.storage?.store) {
      data.i18nStamp = Date.now();

      const version = this.getVersion(language);
      if (version) {
        data.i18nVersion = version;
      }

      this.storage.setItem(`${this.options.prefix}${language}-${namespace}`, JSON.stringify(data));
    }
  }

  getVersion(language: string) {
    if (this.options.versions) {
      return this.options.versions[language];
    }
    return this.options.defaultVersion;
  }
}

Cache.type = 'backend';

export default Cache