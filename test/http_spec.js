'use strict';

describe('$http', function () {

  var $http;
  var xhr, requests;
  var globalURL = 'http://teropa.info';

  beforeEach(function () {
    publishExternalAPI();
    var injector = createInjector(['ng']);
    $http = injector.get('$http');
  });

  beforeEach(function () {
    xhr = sinon.useFakeXMLHttpRequest();
    requests = [];
    xhr.onCreate = function (req) {
      requests.push(req);
    };
  });

  afterEach(function () {
    xhr.restore();
  });


  it('is a function', function () {

    expect($http instanceof Function).toBe(true);
  });

  it('returns a Promise', function () {

    var result = $http({});
    expect(result).toBeDefined();
    expect(result.then).toBeDefined();

  });

  it('makes an XMLHttpRequest to given URL', function () {

    $http({
      method: 'POST',
      url: globalURL,
      data: 'hello'
    });

    expect(requests.length).toBe(1);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe(globalURL);
    expect(requests[0].async).toBe(true);
    expect(requests[0].requestBody).toBe('hello');

  });

  it('resolves promise when XHR result received', function () {

    var requestConfig = {
      method: 'GET',
      url: globalURL
    };

    var response = {};
    $http(requestConfig).then(function(r) {
      response = r;
    });

    requests[0].respond(200, {}, 'Hello');

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
    expect(response.data).toBe('Hello');
    expect(response.config.url).toEqual(globalURL);

  });

  it('rejects promise when XHR result received with error status', function () {

    var requestConfig = {
      method: 'GET',
      url: globalURL
    };

    var response = {};
    $http(requestConfig).catch(function(r) {
      response = r;
    });

    requests[0].respond(401, {}, 'Fail');

    expect(response).toBeDefined();
    expect(response.status).toBe(401);
    expect(response.statusText).toBe('Unauthorized');
    expect(response.data).toBe('Fail');
    expect(response.config.url).toEqual(globalURL);

  });

  it('rejects promise when XHR result errors/aborts', function () {

    var requestConfig = {
      method: 'GET',
      url: globalURL
    };

    var response = {};
    $http(requestConfig).catch(function(r) {
      response = r;
    });

    requests[0].onerror();

    expect(response).toBeDefined();
    expect(response.status).toBe(0);
    expect(response.data).toBe(null);
    expect(response.config.url).toEqual(globalURL);

  });

  //Default Request Configuration

  it('uses GET method by default', function () {

    var requestConfig = {
      url: globalURL
    };

    $http(requestConfig);

    expect(requests.length).toBe(1);
    expect(requests[0].method).toBe('GET');

  });

  // Request Headers

  it('sets headers on request', function () {

    var requestConfig = {
      url: globalURL,
      headers: {
        'Accept': 'text/plain',
        'Cache-Control': 'no-cache'
      }
    };

    $http(requestConfig);

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders.Accept).toBe('text/plain');
    expect(requests[0].requestHeaders['Cache-Control']).toBe('no-cache');

  });

  it('sets default headers on request', function () {

    var requestConfig = {
      url: globalURL,
    };

    $http(requestConfig);

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders.Accept).toBe('application/json, text/plain, */*');

  });

  it('sets method specific default headers on request', function () {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: '42'
    };

    $http(requestConfig);

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).toBe('application/json;charset=utf-8');

  });

  it('exposes default headers for overriding', function () {

    $http.defaults.headers.post['Content-Type'] = 'text/plain;charset=utf8';

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: '42'
    };

    $http(requestConfig);

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).toBe('text/plain;charset=utf-8');

  });

  it('exposes default headers through provider', function () {

    var injector = createInjector(['ng', function ($httpProvider) {
      $httpProvider.defaults.headers.post['Content-Type'] = 'text/plain;charset=utf-8';
    }]);

    $http = injector.get('$http');

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: '42'
    };

    $http(requestConfig);

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).toBe('text/plain;charset=utf-8');

  });

  it('merges default headers case insensitively', function () {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: '42',
      headers: {
        'content-type': 'text/plain;charset=utf-8'
      }
    };

    $http(requestConfig);

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['content-type']).toBe('text/plain;charset=utf-8');
    expect(requests[0].requestHeaders['Content-Type']).toBeUndefined();

  });

  it('does not send content-type header when no data', function () {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      }
    };

    $http(requestConfig);

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).not.toBe('application/json;charset=utf-8');

  });


  it('supports function as headers value', function () {

    var contentTypeSpy = jasmine.createSpy().and.returnValue('text/plain;charset=utf-8');
    $http.defaults.headers.post['Content-Type'] = contentTypeSpy;

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: '42',
    };

    $http(requestConfig);

    expect(contentTypeSpy).toHaveBeenCalledWith(requestConfig);
    expect(requests[0].requestHeaders['Content-Type']).toBe('text/plain;charset=utf-8');

  });

  it('ignores header function value when null/undefined', function () {

    var cacheControlSpy = jasmine.createSpy().and.returnValue(null);
    $http.defaults.headers.post['Cache-Control'] = cacheControlSpy;

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: '42',
    };

    $http(requestConfig);

    expect(cacheControlSpy).toHaveBeenCalledWith(requestConfig);
    expect(requests[0].requestHeaders['Cache-Control']).toBeUndefined();

  });

  // Response Headers

  it('makes response headers available', function () {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42
    };

    var response = {};
    $http(requestConfig).then(function (r) {
      response = r;
    });

    requests[0].respond(200, {'Content-Type': 'text/plain'}, 'Hello');

    expect(response.headers).toBeDefined();
    expect(response.headers instanceof Function).toBe(true);
    expect(response.headers('Content-Type')).toBe('text/plain');
    expect(response.headers('content-type')).toBe('text/plain');

  });

  it('may returns all response headers', function () {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42
    };

    var response = {};
    $http(requestConfig).then(function (r) {
      response = r;
    });

    requests[0].respond(200, {'Content-Type': 'text/plain'}, 'Hello');

    expect(response.headers()).toEqual({'content-type': 'text/plain'});

  });

  // CORS

  it('allows setting withCredentials', function () {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42,
      withCredentials: true
    };

    $http(requestConfig);

    expect(requests[0].withCredentials).toBe(true);

  });

  it('allows setting withCredentials from defaults', function () {

    $http.defaults.withCredentials = true;

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42,
    };

    $http(requestConfig);

    expect(requests[0].withCredentials).toBe(true);

  });

  // Request transform

  it('allows transforming request with functions', function () {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42,
      transformRequest: function (data) {
        return '*' + data + '*';
      }
    };

    $http(requestConfig);

    expect(requests[0].requestBody).toEqual('*42*');

  });

  it('allows multiple request transform functions', function () {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42,
      transformRequest: [function (data) {
        return '*' + data + '*';
      }, function (data) {
        return '-' + data + '-';
      }]
    };

    $http(requestConfig);

    expect(requests[0].requestBody).toEqual('-*42*-');

  });

  it('allows settings transforms in defaults', function () {

    $http.defaults.transformRequest  = [function (data) {
      return '*' + data + '*';
    }];

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42,
    };

    $http(requestConfig);

    expect(requests[0].requestBody).toEqual('*42*');

  });

  it('passes request to headers getter to transform', function () {

    $http.defaults.transformRequest  = [function (data, headers) {
      if(headers('Content-Type') === 'text/emphasized') {
        return '*' + data + '*';
      } else {
        return data;
      }
    }];

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42,
      headers: {
        'content-type': 'text/emphasized'
      }
    };

    $http(requestConfig);

    expect(requests[0].requestBody).toEqual('*42*');

  });

  // Response Transforms

  it('allows transforming responses with functions', function () {

    var response={};

    var requestConfig = {
      url: globalURL,
      transformResponse: function (data) {
        return '*' + data + '*';
      }
    };

    $http(requestConfig).then(function (r) {
      response = r;
    });

    requests[0].respond(200, {'Content-Type': 'text/plain'}, 'Hello');
    expect(response.data).toEqual('*Hello*');

  });

  it('allows setting default responses transform', function () {

    $http.defaults.transformResponse = [function (data) {
      return '*' + data + '*';
    }];

    var response= {};

    var requestConfig = {
      url: globalURL
    };

    $http(requestConfig).then(function (r) {
      response = r;
    });

    requests[0].respond(200, {'Content-Type': 'text/plain'}, 'Hello');
    expect(response.data).toEqual('*Hello*');

  });

  it('transforms error response also', function () {

    var response= {};

    var requestConfig = {
      url: globalURL,
      transformResponse: function (data) {
        return '*' + data + '*';
      }
    };

    $http(requestConfig).catch(function (r) {
      response = r;
    });

    requests[0].respond(401, {'Content-Type': 'text/plain'}, 'Fail');
    expect(response.data).toEqual('*Fail*');

  });

  it('passes HTTP status to response transformers', function () {

    var response= {};

    var requestConfig = {
      url: globalURL,
      transformResponse: function (data, headers, status) {
        if(status === 401) {
          return 'unauthorized'
        } else {
          return data;
        }
      }
    };

    $http(requestConfig).catch(function (r) {
      response = r;
    });

    requests[0].respond(401, {'Content-Type': 'text/plain'}, 'Fail');
    expect(response.data).toEqual('unauthorized');

  });

});
