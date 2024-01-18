import { ReadCallback } from "i18next";
import { LocatsCacheBackendOptions } from "../";

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
    store
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