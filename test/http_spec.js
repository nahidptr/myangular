'use strict';

describe('$http', function () {

  var $http, $rootScope;
  var xhr, requests;
  var globalURL = 'http://teropa.info';

  beforeEach(function () {
    publishExternalAPI();
    var injector = createInjector(['ng']);
    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');
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

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders.Accept).toBe('text/plain');
    expect(requests[0].requestHeaders['Cache-Control']).toBe('no-cache');

  });

  it('sets default headers on request', function () {

    var requestConfig = {
      url: globalURL,
    };

    $http(requestConfig);

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).toBe('text/plain;charset=utf-8');

  });

  it('exposes default headers through provider', function () {

    var injector = createInjector(['ng', function ($httpProvider) {
      $httpProvider.defaults.headers.post['Content-Type'] = 'text/plain;charset=utf-8';
    }]);

    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: '42'
    };

    $http(requestConfig);

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).not.toBe('application/json;charset=utf-8');

  });


  it('supports function as headers value', function () {

    var contentTypeSpy = jasmine.createSpy().and.returnValue('text/plain;charset=utf-8');
    $http.defaults.headers.post['Content-Type'] = contentTypeSpy;

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: '42'
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(contentTypeSpy).toHaveBeenCalledWith(requestConfig);
    expect(requests[0].requestHeaders['Content-Type']).toBe('text/plain;charset=utf-8');

  });

  it('ignores header function value when null/undefined', function () {

    var cacheControlSpy = jasmine.createSpy().and.returnValue(null);
    $http.defaults.headers.post['Cache-Control'] = cacheControlSpy;

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: '42'
    };

    $http(requestConfig);

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

    expect(requests[0].withCredentials).toBe(true);

  });

  it('allows setting withCredentials from defaults', function () {

    $http.defaults.withCredentials = true;

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42
    };

    $http(requestConfig);

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

    expect(requests[0].requestBody).toEqual('-*42*-');

  });

  it('allows settings transforms in defaults', function () {

    $http.defaults.transformRequest  = [function (data) {
      return '*' + data + '*';
    }];

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: 42
    };

    $http(requestConfig);

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

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

    $rootScope.$apply();

    requests[0].respond(401, {'Content-Type': 'text/plain'}, 'Fail');
    expect(response.data).toEqual('unauthorized');

  });

  // JSON Serialization and Parsing

  it('serializes object data to JSON for request', function() {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: {aKey: 42 }
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].requestBody).toBe('{"aKey":42}');

  });

  it('serializes array data to JSON request', function() {

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: [1, 'two', 3]
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].requestBody).toBe('[1,"two",3]');

  });

  // it('does not serialize blob for request', function() {
  //
  //   var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
  //   var bb = new window.WebKitBlobBuilder();
  //   bb.append('hello');
  //   var blob = bb.getBlob('text/plain');
  //
  //   var requestConfig = {
  //     method: 'POST',
  //     url: globalURL,
  //     data: blob
  //   };
  //
  //   $http(requestConfig);
  //
  //   expect(requests[0].requestBody).toBe(blob);
  //
  // });

  it('does not serialize form data for request', function() {

    var formData = new FormData();
    formData.append('aField', 'value');

    var requestConfig = {
      method: 'POST',
      url: globalURL,
      data: formData
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].requestBody).toBe(formData);

  });

  it('parses JSON data for JSON responses', function() {

    var response = {};

    var requestConfig = {
      method: 'GET',
      url: globalURL
    };

    $http(requestConfig).then(r => response = r);

    $rootScope.$apply();

    requests[0].respond(200, {'Content-Type': 'application/json'}, '{"message":"hello"}');

    expect(_.isObject(response.data)).toBe(true);
    expect(response.data.message).toBe('hello');

  });

  it('parses JSON object response without content type', function() {

    var response = {};

    var requestConfig = {
      method: 'GET',
      url: globalURL
    };

    $http(requestConfig).then(r => response = r);

    $rootScope.$apply();

    requests[0].respond(200, {}, '{"message":"hello"}');

    expect(_.isObject(response.data)).toBe(true);
    expect(response.data.message).toBe('hello');

  });

  it('parses JSON array response without content type', function() {

    var response = {};

    var requestConfig = {
      method: 'GET',
      url: globalURL
    };

    $http(requestConfig).then(r => response = r);

    $rootScope.$apply();

    requests[0].respond(200, {}, '[1, 2, 3]');

    expect(_.isArray(response.data)).toBe(true);
    expect(response.data).toEqual([1, 2, 3]);

  });

  it('does not choke on response resembling JSON but not valid', function() {

    var response = {};

    var requestConfig = {
      method: 'GET',
      url: globalURL
    };

    $http(requestConfig).then(r => response = r);

    $rootScope.$apply();

    requests[0].respond(200, {}, '{1, 2, 3]');

    expect(response.data).toEqual('{1, 2, 3]');

  });


  it('does not try to parse interpolation expr as JSON', function() {

    var response = {};

    var requestConfig = {
      method: 'GET',
      url: globalURL
    };

    $http(requestConfig).then(r => response = r);

    $rootScope.$apply();

    requests[0].respond(200, {}, '{{expr}}');

    expect(response.data).toEqual('{{expr}}');

  });

  // URL Parameters

  it('adds params to URL', function () {

    var requestConfig = {
      url: globalURL,
      params: {
        a: 42
      }
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?a=42');

  });

  it('adds additional params to URL', function () {

    var requestConfig = {
      url: globalURL + '?a=42',
      params: {
        b: 42
      }
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?a=42&b=42');

  });

  it('escapes url characters in params', function () {

    var requestConfig = {
      url: globalURL,
      params: {
        '==': '&&'
      }
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?%3D%3D=%26%26');

  });

  it('does not attach null or undefined params', function () {

    var requestConfig = {
      url: globalURL,
      params: {
        a: null,
        b: undefined
      }
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL);

  });

  it('attaches multiple params from arrays', function () {

    var requestConfig = {
      url: globalURL,
      params: {
        a: [42, 43]
      }
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?a=42&a=43');

  });

  it('serializes objects to json', function () {

    var requestConfig = {
      url: globalURL,
      params: {
        a: {b: 42}
      }
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?a=%7B%22b%22%3A42%7D');

  });

  it('allows substituting param serializer', function () {

    var requestConfig = {
      url: globalURL,
      params: {
        a: 42,
        b: 43
      },
      paramSerializer: function (params) {
        return _.map(params, function (v, k) {
          return k + '=' + v + 'lol';
        }).join('&');
      }
    };

    $http(requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?a=42lol&b=43lol');

  });

  it('allows substituting param serializer through DI', function () {

    var injector = createInjector(['ng', function ($provide) {

      $provide.factory('mySpecialSerializer', function () {
        return function (params) {
          return _.map(params, function (v, k) {
            return k + '=' + v + 'lol';
          }).join('&');
        };
      });
    }]);

    injector.invoke(function ($http, $rootScope) {
      var requestConfig = {
        url: globalURL,
        params: {
          a: 42,
          b: 43
        },
        paramSerializer: 'mySpecialSerializer'
      };

      $http(requestConfig);

      $rootScope.$apply();

      expect(requests[0].url).toBe(globalURL + '?a=42lol&b=43lol');

    });

  });

  it('makes default param serializer available through DI', function () {

    var injector = createInjector(['ng']);

    injector.invoke(function ($httpParamSerializer) {

      var result = $httpParamSerializer({a: 42, b: 43});
      expect(result).toEqual('a=42&b=43');

    });

  });


  describe('JQ like param serialization', function () {

    it('is possible', function () {

      var requestConfig = {
        url: globalURL,
        params: {
          a: 42,
          b: 43
        },
        paramSerializer: '$httpParamSerializerJQLike'
      };

      $http(requestConfig);

      $rootScope.$apply();

      expect(requests[0].url).toEqual(globalURL + '?a=42&b=43');

    });

    it('uses square brackets in arrays', function () {

      var requestConfig = {
        url: globalURL,
        params: {
          a: [42, 43]
        },
        paramSerializer: '$httpParamSerializerJQLike'
      };

      $http(requestConfig);

      $rootScope.$apply();

      expect(requests[0].url).toEqual(globalURL + '?a%5B%5D=42&a%5B%5D=43');

    });

    it('uses square brackets in objects', function () {

      var requestConfig = {
        url: globalURL,
        params: {
          a: {b: 42, c: 43}
        },
        paramSerializer: '$httpParamSerializerJQLike'
      };

      $http(requestConfig);

      $rootScope.$apply();

      expect(requests[0].url).toEqual(globalURL + '?a%5Bb%5D=42&a%5Bc%5D=43');

    });

    it('supports nesting in objects', function () {

      var requestConfig = {
        url: globalURL,
        params: {
          a: {b: {c: 42 }}
        },
        paramSerializer: '$httpParamSerializerJQLike'
      };

      $http(requestConfig);

      $rootScope.$apply();

      expect(requests[0].url).toEqual(globalURL + '?a%5Bb%5D%5Bc%5D=42');

    });

    it('appends array indexes when items are objects', function () {

      var requestConfig = {
        url: globalURL,
        params: {
          a: [{b: 42 }]
        },
        paramSerializer: '$httpParamSerializerJQLike'
      };

      $http(requestConfig);

      $rootScope.$apply();

      expect(requests[0].url).toEqual(globalURL + '?a%5B0%5D%5Bb%5D=42');

    });

  });

  // ShortHand Methods

  it('supports shorthand method for GET', function () {

    var requestConfig = {
      params: { q: 42 }
    };

    $http.get(globalURL, requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?q=42');
    expect(requests[0].method).toBe('GET');

  });

  it('supports shorthand method for HEAD', function () {

    var requestConfig = {
      params: { q: 42 }
    };

    $http.head(globalURL, requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?q=42');
    expect(requests[0].method).toBe('HEAD');

  });

  it('supports shorthand method for DELETE', function () {

    var requestConfig = {
      params: { q: 42 }
    };

    $http.delete(globalURL, requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?q=42');
    expect(requests[0].method).toBe('DELETE');

  });

  it('supports shorthand method for POST with data', function () {

    var requestConfig = {
      params: { q: 42 }
    };

    $http.post(globalURL, 'data', requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?q=42');
    expect(requests[0].method).toBe('POST');
    expect(requests[0].requestBody).toBe('data');

  });

  it('supports shorthand method for PUT with data', function () {

    var requestConfig = {
      params: { q: 42 }
    };

    $http.put(globalURL, 'data', requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?q=42');
    expect(requests[0].method).toBe('PUT');
    expect(requests[0].requestBody).toBe('data');

  });

  it('supports shorthand method for PATCH with data', function () {

    var requestConfig = {
      params: { q: 42 }
    };

    $http.patch(globalURL, 'data', requestConfig);

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL + '?q=42');
    expect(requests[0].method).toBe('PATCH');
    expect(requests[0].requestBody).toBe('data');

  });



  // Interceptors
  it('allows attaching interceptor factories', function () {

    var interceptorFactorySpy = jasmine.createSpy();
    var injector = createInjector(['ng', function ($httpProvider) {
      $httpProvider.interceptors.push(interceptorFactorySpy);
    }]);

    $http = injector.get('$http');

    expect(interceptorFactorySpy).toHaveBeenCalled();

  });

  it('uses DI to instantiate interceptor', function () {

    var interceptorFactorySpy = jasmine.createSpy();

    var injector = createInjector(['ng', function ($httpProvider) {
      $httpProvider.interceptors.push(['$rootScope', interceptorFactorySpy]);
    }]);

    $http = injector.get('$http');
    var $rootScope = injector.get('$rootScope');

    expect(interceptorFactorySpy).toHaveBeenCalledWith($rootScope);

  });

  it('allows referencing existing interceptor factories', function () {

    var interceptorFactorySpy = jasmine.createSpy().and.returnValue({});

    var injector = createInjector(['ng', function ($provide, $httpProvider) {

      $provide.factory('myInterceptor', interceptorFactorySpy);
      $httpProvider.interceptors.push('myInterceptor');
    }]);

    $http = injector.get('$http');

    expect(interceptorFactorySpy).toHaveBeenCalled();

  });

  it('allows intercepting request', function () {

    var injector = createInjector(['ng', function ($httpProvider) {

      $httpProvider.interceptors.push(function() {
          return {
            request: function (config) {
              config.params.intercepted = true;
              return config;
            }
          };
        });
    }]);

    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    $http.get(globalURL, {params: {}});

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL+'?intercepted=true');

  });

  it('allows returning promises from request intercepts', function () {

    var injector = createInjector(['ng', function ($httpProvider) {

      $httpProvider.interceptors.push(function($q) {
          return {
            request: function (config) {
              config.params.intercepted = true;
              return $q.when(config);
            }
          };
        });
    }]);

    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    $http.get(globalURL, {params: {}});

    $rootScope.$apply();

    expect(requests[0].url).toBe(globalURL+'?intercepted=true');

  });

  it('allows intercepting responses', function () {

    var injector = createInjector(['ng', function ($httpProvider) {

      $httpProvider.interceptors.push(function() {
          return {
            response: function (response) {
              response.intercepted = true;
              return response;
            }
          };
        });
    }]);

    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    var response={};
    $http.get(globalURL).then(r=> response = r);


    $rootScope.$apply();

    requests[0].respond(200, {}, 'Hello');

    expect(response.intercepted).toBe(true);

  });

  it('allows intercepting request errors', function () {

    var requestErrorSpy = jasmine.createSpy();

    var injector = createInjector(['ng', function ($httpProvider) {
      $httpProvider.interceptors.push(_.constant({
        request: function (config) {
          throw 'fail';
        }
      }));

      $httpProvider.interceptors.push(_.constant({
        requestError: requestErrorSpy
      }));

    }]);


    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    $http.get(globalURL);

    $rootScope.$apply();

    expect(requests.length).toBe(0);
    expect(requestErrorSpy).toHaveBeenCalledWith('fail');

  });

  it('allows intercepting response errors', function () {

    var responseErrorSpy = jasmine.createSpy();

    var injector = createInjector(['ng', function ($httpProvider) {

      $httpProvider.interceptors.push(_.constant({
        responseError: responseErrorSpy
      }));

      $httpProvider.interceptors.push(_.constant({
        response: function (config) {
          throw 'fail';
        }
      }));

    }]);


    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    $http.get(globalURL);

    $rootScope.$apply();

    requests[0].respond(200, {}, 'Hello');

    expect(responseErrorSpy).toHaveBeenCalledWith('fail');

  });

});
