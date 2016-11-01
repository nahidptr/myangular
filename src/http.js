'use strict';

function $HttpParamSerializerProvider() {
  this.$get = function () {
    return function serializeParams(params) {
      var parts = [];
      _.forEach(params, function (value, key) {
        if(_.isNull(value) || _.isUndefined(value)) {
          return;
        }

        if(!_.isArray(value)) {
          value = [value];
        }

        _.forEach(value, function (v) {
          if(_.isObject(v)) {
            v = JSON.stringify(v);
          }
          parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
        });

      });
      return parts.join('&');
    };
  };
}

function $HttpParamSerializerJQLikeProvider() {

  this.$get = function () {
    return function (params) {
      var parts = [];

      function serialize(value, prefix, topLevel) {
        if(_.isNull(value) || _.isUndefined(value)) {
          return;
        }

        if(_.isArray(value)) {
          _.forEach(value, function (v, i) {
            serialize(v, prefix + '[' + (_.isObject(v) ? i : '') + ']');
          });
        } else if(_.isObject(value) && !_.isDate(value)) {

          _.forEach(value, function (v, k) {
            serialize(v, prefix + (topLevel ? '': '[') + k + (topLevel ? '': ']'));
          })
        } else {
          parts.push(encodeURIComponent(prefix) + '=' + encodeURIComponent(value));

        }
      }

      serialize(params, '', true);
      return parts.join('&');
    };
  };
}



function $HttpProvider() {

  var interceptorFactories = this.interceptors = [];

  function isBlob(object) {
    return object.toString() === '[object Blob]';
  }

  function isFile(object) {
    return object.toString() === '[object File]';
  }

  function isFormData(object) {
    return object.toString() === '[object FormData]';
  }

  function defaultHtpResponseTransform(data, headers) {
    if(_.isString(data)) {
      var contentType = headers('Content-Type');
      if((contentType && contentType.indexOf('application/json') === 0) || isJsonLike(data)) {
        return JSON.parse(data);
      }
    }
    return data;
  }

  function isJsonLike(data) {
    if(data.match(/^\{(?!\{)/)) {  //! negative lookahead
      return data.match(/\}$/);
    } else if(data.match(/^\[/)) {
      return data.match(/\]$/);
    }
  }

  var defaults = this.defaults = {
    headers: {
      common: {
        'Accept': 'application/json, text/plain, */*'
      },
      post: {
        'Content-Type': 'application/json;charset=utf8'
      },
      put: {
        'Content-Type': 'application/json;charset=utf8'
      },
      patch: {
        'Content-Type': 'application/json;charset=utf8'
      }
    },

    transformRequest: [function (data) {
      if(_.isObject(data) && !isBlob(data) && !isFile(data) && !isFormData(data)) {
        return JSON.stringify(data);
      } else {
        return data;
      }
    }],

    transformResponse: [defaultHtpResponseTransform],

    paramSerializer: '$httpParamSerializer'
  };

  this.$get = ['$httpBackend', '$q', '$rootScope', '$injector', function ($httpBackend, $q, $rootScope, $injector) {

    var interceptors = _.map(interceptorFactories, function (fn) {
      if(_.isString(fn)) {
        return $injector.get(fn);
      } else {
        return $injector.invoke(fn);
      }
    });

    function serverRequest(config) {

      if (_.isUndefined(config.withCredentials) && !_.isUndefined(defaults.withCredentials)) {
        config.withCredentials = defaults.withCredentials;
      }

      var reqData = transformData(config.data, headersGetter(config.headers), undefined, config.transformRequest);

      if (_.isUndefined(reqData)) {
        _.forEach(config.headers, function (v, k) {
          if (k.toLowerCase() === 'content-type') {
            delete config.headers[k];
          }
        });
      }

      function transformResponse(response) {
        if(response.data) {
          response.data = transformData(response.data, response.headers, response.status, config.transformResponse);
        }
        if(isSuccess(response.status)) {
          return response;
        } else {
          return $q.reject(response);
        }
      }

      return sendReq(config, reqData).then(transformResponse, transformResponse);

    }

    function isSuccess(status) {
      return status >=200 && status < 300;
    }

    function executeHeaderFns(headers, config) {
      return _.transform(headers, function (result, v, k) {
        if(_.isFunction(v)) {
          v = v(config);
          if(_.isNull(v) || _.isUndefined(v)) {
            delete result[k];
          } else {
            result[k] = v;
          }
        }
      }, headers);
    }

    function mergeHeaders(config) {

      var reqHeaders = _.extend({}, config.headers);

      var defaultHeaders = _.extend({}, defaults.headers.common,
        defaults.headers[(config.method || 'get').toLowerCase()] );

      _.forEach(defaultHeaders, function (value, key) {

        var headerExist = _.some(reqHeaders, function (v, k) {
          return k.toLowerCase() === key.toLowerCase();
        });

        if(!headerExist) {
          reqHeaders[key] = value;
        }
      });

      return executeHeaderFns(reqHeaders, config);
    }

    function headersGetter(headers) {

      function parseHeaders(headersStr) {

        if(_.isObject(headersStr)) {
          return _.transform(headersStr, function (result, v, k) {
            result[_.trim(k.toLowerCase())] = _.trim(v);
          }, {});
        } else {
          var lines = headersStr.split('\n');
          return _.transform(lines, function (result, line) {

            var separatorAt = line.indexOf(':');
            var name = _.trim(line.substr(0, separatorAt)).toLowerCase();
            var value = _.trim(line.substr(separatorAt + 1));
            if (name) {
              result[name] = value;
            }
          }, {});
        }
      }

      var headersObj;
      return function (name) {
        headersObj = headersObj || parseHeaders(headers);
        return (name) ? headersObj[name.toLowerCase()]: headersObj;
      };
    }

    function transformData(data, headers, status, transform) {
      if(_.isFunction(transform)) {
        return transform(data, headers, status);
      } else {
        //! allow multiple transform chain
        return _.reduce(transform, function (data, fn) {
          return fn(data, headers, status);
        }, data);
      }
    }


    function buildUrl(url, serializedParams) {
      if(serializedParams.length) {
        url += (url.indexOf('?') === -1) ? '?' : '&';
        url += serializedParams;
      }
      return url;
    }

    function sendReq(config, reqData) {

      var deferred = $q.defer();

      var done = function done(status, response, headersString, statusText) {
        status = Math.max(status, 0);
        deferred[isSuccess(status) ? 'resolve': 'reject'](
          {
            status: status,
            data: response,
            statusText: statusText,
            headers: headersGetter(headersString),
            config: config,
          }
        );

        if(!$rootScope.$$phase) {
          $rootScope.$apply();
        }
      };

      var url = buildUrl(config.url,  config.paramSerializer(config.params));

      $httpBackend(
        config.method,
        url,
        reqData,
        done,
        config.headers,
        config.withCredentials
      );

      return deferred.promise;

    }

    //! returned fn, along with defaults object
    function $http(requestConfig) {

      var config = _.extend({
        method: 'GET',
        transformRequest: defaults.transformRequest,
        transformResponse: defaults.transformResponse,
        paramSerializer: defaults.paramSerializer
      }, requestConfig);


      if(_.isString(config.paramSerializer)) {
        config.paramSerializer = $injector.get(config.paramSerializer);
      }
      config.headers = mergeHeaders(requestConfig);

      var promise = $q.when(config);
      _.forEach(interceptors, function (interceptor) {
        promise = promise.then(interceptor.request, interceptor.requestError);
      });
      promise = promise.then(serverRequest);
      _.forEachRight(interceptors, function (interceptor) {
        promise = promise.then(interceptor.response, interceptor.responseError);
      });
      return promise;

    }

    $http.defaults = defaults;
    _.forEach(['get', 'head', 'delete'], function (method) {

      return $http[method] = function (url, config) {
        return $http(_.extend(config || {}, {
          method: method.toUpperCase(),
          url: url
        }));
      };

    });

    _.forEach(['post', 'put', 'patch'], function (method) {

      return $http[method] = function (url, data, config) {
        return $http(_.extend(config || {}, {
          method: method.toUpperCase(),
          url: url,
          data: data
        }));
      };

    });


    return $http;

  }];

}
