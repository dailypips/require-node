'use strict';

define(function (require, exports, module) {
    //var q = require('q');

    module.exports = function () {
        //console.log(new Date(), this, arguments);
        if (arguments.length < 2) {
            throw { msg: '$require arguments.length < 2' };
        }

        var args = Array.prototype.slice.call(arguments);
        args[2] = Array.prototype.slice.call(args[2]);
        var moduleName = args[0];
        var functionName = args[1];
        var actualParams = args[2];
        var config = args[3] || {};
        var async = !args[4];
        var q = config.q;
        var url = config.path || '/require-node';
        if (config.isDebug) url += '?' + moduleName + '.' + functionName;

        var callback = null;
        if (typeof actualParams[actualParams.length - 1] === 'function') {
            callback = actualParams.pop();
        }

        var headers = { 'Content-Type': 'application/json', 'X-Require-Node': true };
        //添加防止XSRF攻击的http header
        var match = window.document.cookie.match(/(?:^|\s|;)XSRF-TOKEN\s*=\s*([^;]+)(?:;|$)/);
        if (match) {
            headers['X-XSRF-TOKEN'] = match[1];
        }

        if (async) {
            var defer = q.defer();
            var handleSuccess = function (result, status, xhr) {
                config.isDebug && console.log(arguments);
                callback && callback.apply(null, result);
                var err = result.shift();
                if (err) {
                    defer.reject(err);
                }
                else {
                    defer.resolve(result.length > 1 ? result : result[0]);
                }
            }
            var handleError = function (err, status, xhr) {
                config.isDebug && console.log(arguments);
                callback && callback.call(null, err);
                defer.reject(err);
            }
        }

        var options = {
            type: 'POST',
            url: url,
            headers: headers,
            xhrFields: config.xhrFields,
            data: JSON.stringify([moduleName, functionName, actualParams]),
            async: async,
            success: handleSuccess,
            error: handleError
        }

        var ret = window.$ ? $.ajax(options) : _ajax(options);
        if (async) {
            return defer.promise;
        }
        else {
            var res = JSON.parse(ret.responseText);
            config.isDebug && console.log('sync res:', res);
            if (res[0]) {
                throw res[0];
            }
            else {
                return res[1];
            }
        }
    }

    function _ajax(options) {
        var xhr = function () {
            try { return new XMLHttpRequest(); }
            catch (e) {
                try { return new ActiveXObject("Msxml2.XMLHTTP"); }
                catch (e) { return new ActiveXObject("Microsoft.XMLHTTP"); }
            }
        } ()

        xhr.open(options.type, options.url, options.async);

        options.headers = options.headers || {};
        for (var header in options.headers) {
            xhr.setRequestHeader(header, options.headers[header])
        }
        options.xhrFields = options.xhrFields || {};
        for (var field in options.xhrFields) {
            xhr[field] = options.xhrFields[field];
        }

        var requestDone, status, data, noop = null;
        xhr.onreadystatechange = function (isTimeout) {
            // The request was aborted
            if (!xhr || xhr.readyState === 0 || isTimeout === "abort") {
                // Opera doesn't call onreadystatechange before this point
                // so we simulate the call
                if (!requestDone) {
                    options.complete && options.complete(data, status, xhr);
                }

                requestDone = true;
                if (xhr) {
                    xhr.onreadystatechange = noop;
                }

                // The transfer is complete and the data is available, or the request timed out
            }
            else if (!requestDone && xhr && (xhr.readyState === 4 || isTimeout === "timeout")) {
                requestDone = true;
                xhr.onreadystatechange = noop;

                status = isTimeout === "timeout" ?
                    "timeout" :
                    !httpSuccess(xhr) ?//really success?
                        "error" : "success";

                var errMsg;

                if (status === "success") {
                    // Watch for, and catch, XML document parse errors
                    try {
                        // process the data (runs the xml through httpData regardless of callback)
                        data = JSON.parse(xhr.responseText);
                    }
                    catch (parserError) {
                        status = "parsererror";
                        errMsg = parserError;
                    }
                }

                // Make sure that the request was successful or notmodified
                if (status === "success" || status === "notmodified") {
                    // JSONP handles its own success callback
                    options.success && options.success(data, status, xhr);
                }
                else {
                    options.error && options.error(xhr, status, xhr);
                }

                // Fire the complete handlers
                options.complete && options.complete(data, status, xhr);

                if (isTimeout === "timeout") {
                    xhr.abort();
                }
            }
        };

        xhr.send(options.data);
        return xhr;
    }

    // Determines if an XMLHttpRequest was successful or not
    function httpSuccess(xhr) {
        try {
            // IE error sometimes returns 1223 when it should be 204 so treat it as success, see #1450
            return !xhr.status && location.protocol === "file:" ||
                xhr.status >= 200 && xhr.status < 300 ||
                xhr.status === 304 || xhr.status === 1223;
        } catch (e) { }

        return false;
    }
});