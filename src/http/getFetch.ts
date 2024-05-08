// Hiện tại chỉ đang check call api phía client. Có thể bổ sung thêm bên server-side
var fetchApi: any;
if (typeof fetch === 'function') {
  if (typeof window !== 'undefined' && window.fetch) {
    fetchApi = window.fetch;
  } else {
    fetchApi = fetch;
  }
}

export default fetchApi;