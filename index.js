'use strict';

//防止此文件被意外require到了前台
if (typeof window != 'undefined') { var errMsg = '【严重错误】前台代码引入此代码会导致缓慢，因为代码中有require("../.." + modulePath)！！！'; alert(errMsg); throw errMsg; }

var config = {
    alias: {},
    resolve: null,
    _inject: function (req, res, callback) {
        return {
            $res: res,
            $req: req,
            $session: req && req.session,
            $body: req.body,
            callback: callback,

            $origin: req.headers && (req.headers.origin || 'http://' + (req.headers.host || req.hostname)),
            $hostname: req.hostname,
            $query: req.query
        }
    }
};
var aliasPathDict = {};

function call(req, res, next) {
    _formatReqRes(req, res).then(function () {
        const originalUrlPath = req.originalUrl.split('?', 1)[0];
        if (aliasPathDict[originalUrlPath]) {
            //如下代码for seajs or requirejs loader
            var _browserify = require('./_browserify');
            try {
                res.status(200).send(_browserify.toCMD('../..' + originalUrlPath, aliasPathDict[originalUrlPath], config));
            }
            catch (err) {
                console.log(err && err.stack || err);
                console.log('_browserify err:', originalUrlPath, aliasPathDict[originalUrlPath]);
                res.status(404).send(err && err.stack);
            }
            return;
        }
        else if (!originalUrlPath.startsWith(config.path || '/require-node')) {
            if (next) {
                config.isDebug && console.log('此请求本中间件不处理:', originalUrlPath);
                next();
            }
            else {
                res.status(404).send('');
            }
            return;
        }

        var params = getParams(req);
        //console.log('call params:', params);
        var moduleName = params[0];
        var functionName = params[1];
        var moduleInstance = getModuleInstance(moduleName);
        if (!moduleInstance) {
            throw { statusCode: 404, msg: '没有此模块:' + moduleName + '.' + functionName };
        }
        var moduleFunction = moduleInstance[functionName];
        if (!moduleFunction) {
            throw { statusCode: 404, msg: '没有此方法:' + moduleName + '.' + functionName };
        }
        var actualParams = params[2];
        var formalParams = getModuleFormalParams(moduleFunction);

        return new Promise(function (resolve, reject) {
            if (config.resolve) {
                try {
                    var ret = config.resolve(req, moduleName, functionName, formalParams);
                    if (_isObject(ret) && ret.then) {
                        ret.then(resolve, reject);
                    } else {
                        resolve(ret);
                    }
                }
                catch (err) {
                    reject(err);
                }
            } else {
                resolve(true);
            }
        }).then(function (canCall) {
            if (!canCall) {
                throw { statusCode: 403, msg: '没有权限调用此方法:' + moduleName + '.' + functionName };
            }

            var isCallback = moduleFunctionIsCallback(formalParams);
            if (isCallback) {
                var callbackResolve, callbackReject;
                var callbackPromise = new Promise(function (resolve, reject) { callbackResolve = resolve; callbackReject = reject; });
                var callback = function (err, result) {
                    if (err) {
                        callbackReject(err);
                    }
                    else {
                        if (req.headers['x-require-node']) {
                            callbackResolve(arguments.length <= 2 ? result : Array.prototype.slice.call(arguments, 1));
                        }
                        else {
                            callbackResolve(result);
                        }
                    }
                }
            }

            parseActualParams(actualParams, actualParams, req, res);
            parseActualParams(actualParams, formalParams, req, res, callback);
            var result = moduleFunction.apply(moduleInstance, actualParams);
            return isCallback ? callbackPromise : result;
        });
    }).then(function (result) {
        if (res.finished) {
            return;
        }

        if (req.headers['x-require-node']) {
            res.status(200).send([null, result]);
        }
        else {
            if (result && result.$view) {
                res.render(result.$view, result);
            }
            else {
                res.status(200).send(result);
            }
        }
    }).catch(function (err) {
        config.isDebug && console.log('call err:', err);
        //err的stack属性默认是非枚举类型，改成可枚举，让res.status.send时序列化此属性
        if (err && err.stack) {
            Object.defineProperty(err, 'stack', { value: err.stack, enumerable: true });
            config.isDebug && console.log('call err enumerable stack:', err);
        }

        if (res.finished) {//如果用户已经执行了res.end
            return;
        }

        if (req.headers['x-require-node']) {
            res.status(200).send([err]);
        }
        else {
            if (err && err.$view) {
                res.render(err.$view, err);
            }
            else {
                if (err && err.statusCode === 401 && next) {
                    next();//middleware/loginCheck中间件会处理要求登录问题
                }
                else {
                    res.status(err.statusCode || 500).send(err);
                }
            }
        }
    })
}

var pathPattern = /^\/([^\.\/]+)[\.\/]([^\(\[%]+)(?:(?:\(|\[|%5B)(.+)(?:\)|\]|%5D))?/i; //%5B %5D分别表示[ ]这两个字符
function getParams(req) {
    if (req.headers['x-require-node']) {
        config.isDebug && console.log('x-require-node:', req.method, req.url);
        if (req.body instanceof Array && req.body.length === 3 && req.body[2] instanceof Array) {
            return req.body;
        }
    }
    else {
        var match = (req.path || req.originalUrl.split('?', 1)[0].slice((config.path || '/require-node').length)).match(pathPattern);
        config.isDebug && console.log('call path match', match);
        if (match) {
            if (req.method === 'POST') {
                var params = req.body instanceof Array ? req.body : [];
            }
            else {
                var params = match[3] ? JSON.parse('[' + decodeURIComponent(match[3]) + ']') : [];
            }
            //console.log('params',params);
            return [decodeURIComponent(match[1]), decodeURIComponent(match[2]), params];
        }
    }
    throw { statusCode: 400 };
}

function getModuleInstance(moduleName) {
    var modulePath = getModulePath(moduleName);
    if (!moduleName || !modulePath) {
        console.error('moduleName:', moduleName, ' ,modulePath:', modulePath);
        return null;
    }
    return require('../..' + modulePath);
}

function getModulePath(moduleName) {
    if (!moduleName || typeof moduleName !== 'string') {
        return null;
    }
    //为了安全，最后始终从alias里取出modulePath。如果仅根据moduleName以'/'开始就返回，那么任意后台js都可能被前端调用
    if (moduleName[0] === '/') {
        moduleName = aliasPathDict[moduleName];
    }
    return config.alias[moduleName];
}

function getModuleFormalParams(moduleFunction) {
    //提取形参列表
    if (moduleFunction.$formalParams) {
        return moduleFunction.$formalParams;
    }
    else {
        var formalParamsStr = moduleFunction.toString().split(')')[0].split('(')[1];
        var ret = formalParamsStr ? formalParamsStr.split(',').map(function (i) { return i.trim(); }) : [];
        moduleFunction.$formalParams = ret;//缓存把结果缓存起来
        return ret;
    }
}

function parseActualParams(params, refParams, req, res, callback) {
    var _$inject = config._inject(req, res, callback);
    var $inject = config.inject ? config.inject(req, res, callback) : {};

    refParams.forEach(function (refParam, index) {
        params[index] = $inject[refParam] || _$inject[refParam] || params[index];
    });
}

var callbackFunctionNames;
function moduleFunctionIsCallback(formalParams) {
    if (!callbackFunctionNames) {
        var callback = {};
        var _$inject = config._inject({}, {}, callback);
        var $inject = config.inject ? config.inject({}, {}, callback) : {};
        callbackFunctionNames = [];
        for (let key in _$inject) {
            if (_$inject[key] === callback) {
                callbackFunctionNames.push(key)
            }
        }
        for (let key in $inject) {
            if ($inject[key] === callback) {
                callbackFunctionNames.push(key)
            }
        }
        console.log('callbackFunctionNames:', callbackFunctionNames);
    }
    return formalParams.length > 0 && callbackFunctionNames.indexOf(formalParams[formalParams.length - 1]) > -1;
}

function _formatReqRes(req, res) {
    //console.log('req', req.url, req.originalUrl, req.body);
    req.originalUrl = req.originalUrl || req.url;
    if (!res.status) res.status = (status) => {
        res.statusCode = status;
        return res;
    }
    if (!res.send) res.send = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(typeof data === 'string' ? data : JSON.stringify(data));
    }

    return new Promise(function (resolve, reject) {
        if (req.hasOwnProperty('body')) {
            resolve();
        }
        else {
            require('body-parser').json({ limit: '800mb' })(req, res, resolve)
        }
    }).then(() => _parseDate(req.body));
}

function _parseDate(obj) {
    if (!_isObject(obj)) {
        return;
    }

    for (var key in obj) {
        if (_isObject(obj[key])) {
            _parseDate(obj[key]);
        }
        else if (_isDateTimeStr(obj[key])) {
            obj[key] = new Date(obj[key]);
        }
    }
}

function _isObject(obj) {
    return obj !== null && typeof (obj) === 'object';
}

function _isDateTimeStr(str) {
    return typeof str === "string" && str[10] === "T" && str[str.length - 1] === "Z" && (str.length === 24 || str.length === 20);
}

module.exports = function (options) {
    for (var key in options) {
        config[key] = options[key];
    }
    if (config.alias) {
        for (var moduleName in config.alias) {
            var modulePath = config.alias[moduleName];
            aliasPathDict[modulePath] = moduleName;
            if (modulePath.slice(-3) !== '.js') {
                aliasPathDict[modulePath + '.js'] = moduleName;
            }
        }
    }
    else {
        config.alias = {};
        aliasPathDict = {};
    }
    config.isDebug && console.log('alias', config.alias);
    //console.log('aliasPathDict', aliasPathDict)
    return call;
};
