import { hasXMLHttpRequest } from './utils.js'
import fetchNode from './getFetch.js'
import { LocatsCacheBackendOptions, RequestCallback } from '../../index.js'

let fetchApi: any;
if (typeof fetch === 'function') {
  if (typeof window !== 'undefined' && window.fetch) {
    fetchApi = window.fetch
  } else {
    fetchApi = fetch
  }
}
let XmlHttpRequestApi: any;
if (hasXMLHttpRequest()) {
  if (typeof window !== 'undefined' && window.XMLHttpRequest) {
    XmlHttpRequestApi = window.XMLHttpRequest;
  }
}
let ActiveXObjectApi: any;
if (typeof ActiveXObject === 'function') {
  if (typeof window !== 'undefined' && window.ActiveXObject) {
    ActiveXObjectApi = window.ActiveXObject;
  }
}
if (!fetchApi && fetchNode && !XmlHttpRequestApi && !ActiveXObjectApi) fetchApi = fetchNode;
if (typeof fetchApi !== 'function') fetchApi = undefined

const addQueryString = (url: string, params: any) => {
  if (params && typeof params === 'object') {
    let queryString = ''
    // Must encode data
    for (const paramName in params) {
      queryString += '&' + encodeURIComponent(paramName) + '=' + encodeURIComponent(params[paramName])
    }
    if (!queryString) return url
    url = url + (url.indexOf('?') !== -1 ? '&' : '?') + queryString.slice(1)
  }
  return url
}

const fetchIt = (url: string, fetchOptions: RequestInit, callback: RequestCallback) => {
  const resolver = (response: Response) => {
    if (!response.ok) return callback(response.statusText || 'Error', { status: response.status })
    response.text().then((data) => {
      callback(null, { status: response.status, etag: response.headers.get("etag"), data })
    }).catch((e) => {
      callback(e.message, null);
    })
  }

  if (typeof fetch === 'function') { // react-native debug mode needs the fetch function to be called directly (no alias)
    fetch(url, fetchOptions).then(resolver).catch((e: Error) => {
      callback(e.message, null);
    })
  } else {
    fetchApi(url, fetchOptions).then(resolver).catch((e: Error) => {
      callback(e.message, null);
    })
  }
}

let omitFetchOptions = false

// fetch api stuff
const requestWithFetch = (options: LocatsCacheBackendOptions, url: string, payload: {} | string, callback: RequestCallback) => {
  if (options.queryStringParams) {
    url = addQueryString(url, options.queryStringParams)
  }
  let headers = {
    ...options.customHeaders
  }

  if (payload) {
    headers = {
      ...headers,
      'Content-Type': 'application/json'
    }
  } 
  const reqOptions = typeof options.requestOptions === 'function' ? options.requestOptions(payload) : options.requestOptions
  const fetchOptions: RequestInit = {
    method: payload ? 'POST' : 'GET',
    body: payload ? JSON.stringify(payload) : undefined,
    headers,
    ...(omitFetchOptions ? {} : reqOptions)
    } 
    try {
    fetchIt(url, fetchOptions, callback);
  } catch (e: unknown) {
    if (!reqOptions || Object.keys(reqOptions).length === 0 || (e instanceof Error && !e.message) || (e instanceof Error && e.message.indexOf('not implemented') < 0)) {
      return callback(e, null)
    }
    try {
      Object.keys(reqOptions).forEach((opt) => {
        delete fetchOptions[opt as keyof typeof reqOptions]
      })
      fetchIt(url, fetchOptions, callback)
      omitFetchOptions = true
    } catch (err) {
      callback(err, null)
    }
  }
}

// xml http request stuff
const requestWithXmlHttpRequest = (options: LocatsCacheBackendOptions, url: string, payload: {} | string, callback: Function) => {
  if (payload && typeof payload === 'object') {
    // if (!cache) payload._t = Date.now()
    // URL encoded form payload must be in querystring format
    payload = addQueryString('', payload).slice(1);
  }

  if (options.queryStringParams) {
    url = addQueryString(url, options.queryStringParams)
  }

  try {
    let x: XMLHttpRequest;
    if (XmlHttpRequestApi) {
      x = new XmlHttpRequestApi()
    } else {
      x = new ActiveXObjectApi('MSXML2.XMLHTTP.3.0');
    }
    x.open(payload ? 'POST' : 'GET', url, true);
    if (!options.crossDomain) {
      x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    }
    x.withCredentials = !!options.withCredentials
    if (payload) {
      x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    }
    if (x.overrideMimeType) {
      x.overrideMimeType('application/json');
    }
    let h = options.customHeaders
    if (h) {
      for (const i in h) {
        x.setRequestHeader(i, h[i]);
      }
    }
    x.onreadystatechange = () => {
      x.readyState > 3 && callback(x.status >= 400 ? x.statusText : null, { status: x.status, data: x.responseText })
    }
    x.send(payload as XMLHttpRequestBodyInit)
  } catch (e) {
    console && console.log(e)
  }
}

const request = (
  options: LocatsCacheBackendOptions, 
  url: string, 
  payload: {} | string, 
  callback: RequestCallback
) => {
  if (typeof payload === 'function') {
    callback = payload as RequestCallback;
    payload = {};
  }
  callback = callback || (() => {});

  if (fetchApi && url.indexOf('file:') !== 0) {
    // use fetch api
    return requestWithFetch(options, url, payload, callback);
  }

  if (hasXMLHttpRequest() || typeof ActiveXObject === 'function') {
    // use xml http request
    return requestWithXmlHttpRequest(options, url, payload, callback);
  }

  callback(new Error('No fetch and no xhr implementation found!'), null);
}

export default request