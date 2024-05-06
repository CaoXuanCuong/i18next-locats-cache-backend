var fetchApi: any;
if (typeof fetch === 'function') {
  if (typeof window !== 'undefined' && window.fetch) {
    fetchApi = window.fetch;
  } else {
    fetchApi = fetch;
  }
}

export default fetchApi;