var _qPath;
function getQPath(params) {
    _qPath = _qPath || (require('fs').existsSync(require('path').join(__dirname, 'node_modules/q')) ? 'require-node/node_modules/q' : 'q');
    return _qPath;
}

function toCommonJS(modulePath, moduleName, config) {
    return 'var _require=require("require-node/_require.js");\n' +
        'var q=require("' + getQPath() + '");\n' +
        _exportsFunction(modulePath, moduleName, config);
}

function toCMD(modulePath, moduleName, config) {
    return 'define(function(require,exports,module){\n' +
        'var _require=require("/node_modules/require-node/_require.js");\n' +
        'var q=require("/node_modules/' + getQPath() + '/q.js")||window.Q;\n' +
        _exportsFunction(modulePath, moduleName, config) +
        '\n})';
}

function _exportsFunction(modulePath, moduleName, config) {
    var config = config || {};
    //格式化config
    //糖参数:withCredentials
    if (config.withCredentials) {
        config.xhrFields = config.xhrFields || {};
        config.xhrFields.withCredentials = config.withCredentials;
    }
    if (typeof config.enableSync === 'string') {
        config.enableSync = config.enableSync.split(',');
    }
    var enableSync = config.enableSync === true || config.enableSync instanceof Array && config.enableSync.indexOf(moduleName) > -1;

    var ret = 'var config={q:q';
    ['path', 'isDebug', 'xhrFields'].forEach(key => {
        if (config[key]) {
            ret += ',' + key + ':' + JSON.stringify(config[key]);
        }
    })
    ret += '};\n';
    if (enableSync) { ret += 'exports.$sync={};\n'; }

    var m = require(modulePath);
    var functionNames = [];
    for (f in m) {
        if (typeof m[f] === 'function') {
            functionNames.push(f);
        }
    }
    ret += 'var moduleName=' + JSON.stringify(moduleName) + ';\n';
    ret += functionNames.map(function (f) {
        var fun = '=function(){return _require(moduleName,"' + f + '",arguments,config';
        var ret = 'exports.' + f + fun + ')}';
        if (enableSync) { ret += ';\nexports.$sync.' + f + fun + ',true)}'; }
        return ret;
    }).join(';\n');
    return ret;
}

exports.toCommonJS = toCommonJS;
exports.toCMD = toCMD;