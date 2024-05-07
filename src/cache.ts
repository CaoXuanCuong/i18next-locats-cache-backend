import { ReadCallback } from "i18next";
import { LocaleData, LocatsCacheBackendOptions, RequestCallback } from "../";
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
    parse: (data: string) => JSON.parse(data),
    parsePayload: (namespace: string, key: string | number, fallbackValue: any) => ({ [key]: fallbackValue || '' }),
    parseLoadPayload: (languages: string[], namespaces: string[]) => undefined,
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

  init(services?: any, options?: LocatsCacheBackendOptions): void {
    this.services = services;
    this.options = { ...this.options, ...options };
    this.storage = new Storage(this.options);
  }

  read(language: string, namespace: string, callback: ReadCallback): void {
    this._readAny([language], language, [namespace], namespace, callback);
  }

  _readAny (languages: string[], loadUrlLanguages: string[] | string, namespaces: string[], loadUrlNamespaces: string[] | string, callback: ReadCallback): void {
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

  loadUrl (url: string, callback: ReadCallback, languages: string[] | string, namespaces: string[] | string): void {
    if (!this.storage || !this.storage.store) {
      return callback(null, null);
    }

    const lng = (typeof languages === 'string') ? [languages] : languages;
    const ns = (typeof namespaces === 'string') ? [namespaces] : namespaces;
    let local = this.storage.getItem("".concat(this.options.prefix || "locats_res_").concat(lng[0], "-").concat(ns[0]));
    const nowMS = Date.now();
    const version = this.getVersion(lng[0]);
    const cache = 
        !!local &&
        local.i18nStamp && local.i18nStamp + this.options.expirationTime > nowMS &&
        version === local.i18nVersion;

    let i18nVersion = null;
    let i18nStamp = null;

    if (cache) {
      local = JSON.parse(local);
      i18nVersion = local.i18nVersion;
      i18nStamp = local.i18nStamp;
      delete local.i18nVersion;
      delete local.i18nStamp;

      this.options.customHeaders = {
        ...this.options.customHeaders,
        "If-None-Match": local.i18LocatsEtag
      };
      callback(null, local);
    }
    // parseLoadPayload — default undefined
    const payload = this.options.parseLoadPayload ? this.options.parseLoadPayload(lng, ns) : {};
    if(this.options.request) {
      this.options.request(this.options, url, payload, (err, res) => {
        if (res && ((res.status >= 500 && res.status < 600) || !res.status)) return callback('failed loading ' + url + '; status code: ' + res.status, true /* retry */);
        if (res && res.status >= 400 && res.status < 500) return callback('failed loading ' + url + '; status code: ' + res.status, false /* no retry */);
        if (!res && err && err.message && err.message.indexOf('Failed to fetch') > -1) return callback('failed loading ' + url + ': ' + err.message, true /* retry */);
        if(res.status === 304) return;
        if (err) return callback(err, false);
  
        let ret: any, parseErr: any;
        try {
          if (typeof res.data === 'string' && this.options.parse) {
            ret = this.options.parse(res.data, languages, namespaces);
          } else { // fallback, which omits calling the parse function
            ret = res.data;
          }
        } catch (e) {
          parseErr = 'failed parsing ' + url + ' to json';
        }

        this.storage?.setItem("".concat(this.options?.prefix || "locats_res_").concat(lng[0], "-").concat(ns[0]), JSON.stringify({
          ...ret,
          i18nVersion: i18nVersion || version,
          i18nStamp: i18nStamp || Date.now(),
          i18LocatsEtag: res.etag,
        }));
        if (!cache) {
          if (parseErr) return callback(parseErr, false);
          return callback(null, ret);
        }

      })
    }
  }

  // save(language: string, namespace: string, data: LocaleData): void {
  //   if (this.storage?.store) {
  //     data.i18nStamp = Date.now();

  //     const version = this.getVersion(language);
  //     if (version) {
  //       data.i18nVersion = version;
  //     }

  //     this.storage.setItem(`${this.options.prefix}${language}-${namespace}`, JSON.stringify(data));
  //   }
  // }

  create (languages: string[] | string, namespace: string, key: string, fallbackValue: any, callback: ReadCallback): void {
    // If there is a falsey addPath, then abort -- this has been disabled.
    if (!this.options.addPath) return
    if (typeof languages === 'string') languages = [languages]
    if(!this.options.parsePayload) return;
    const payload = this.options.parsePayload(namespace, key, fallbackValue)
    let finished = 0
    const dataArray: any = []
    const resArray: any = []
    languages.forEach(lng => {
      let addPath = this.options.addPath
      if (typeof this.options.addPath === 'function') {
        addPath = this.options.addPath(lng, namespace)
      }
      const url = this.services.interpolator.interpolate(addPath, { lng, ns: namespace })

      if(this.options.request) {
        this.options.request(this.options, url, payload, (data: any, res: any) => {
          // TODO: if res.status === 4xx do log
          finished += 1
          dataArray.push(data)
          resArray.push(res)
          if (finished !== languages.length) return callback(dataArray, resArray);
          if (typeof callback === 'function') return callback(dataArray, resArray);
        })
      }
    })
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