function toCommonJS(modulePath, moduleName, config) {
    return 'var _require=require("require-node/_require.js");\n' +
        'var q=require("require-node/node_modules/q");\n' +
        _exportsFunction(modulePath, moduleName, config);
}

function toCMD(modulePath, moduleName, config) {
    return 'define(function(require,exports,module){\n' +
        'var _require=require("/node_modules/require-node/_require.js");\n' +
        'var q=require("/node_modules/require-node/node_modules/q/q.js")||window.Q;\n' +
        _exportsFunction(modulePath, moduleName, config) +
        '\n})';
}

function _exportsFunction(modulePath, moduleName, config) {
    var config = config || {};
    //糖参数:withCredentials
    if (config.withCredentials) {
        config.xhrFields = config.xhrFields || {};
        config.xhrFields.withCredentials = config.withCredentials;
    }

    var ret = 'var config={q:q';
    ['path', 'isDebug', 'xhrFields'].forEach(key => {
        if (config[key]) {
            ret += ',' + key + ':' + JSON.stringify(config[key]);
        }
    })
    ret += '}\n';
    if (config.enableSync) { ret += 'exports.$sync={};\n'; }

    var m = require(modulePath);
    var functionNames = [];
    for (f in m) {
        if (typeof m[f] === 'function') {
            functionNames.push(f);
        }
    }
    ret += functionNames.map(function (f) {
        var fun = '=function(){return _require.call(null,"' + moduleName + '","' + f + '",arguments,config';
        var ret = 'exports.' + f + fun + ')}';
        if (config.enableSync) { ret += ';\nexports.$sync.' + f + fun + ',true)}'; }
        return ret;
    }).join(';\n');
    return ret;
}

exports.toCommonJS = toCommonJS;
exports.toCMD = toCMD;